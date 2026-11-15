from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from .dem import DemNoDisponible, FueraDeCobertura, elevacion_m
from .horizons import HorizonError, tierra_y_sol_desde_luna
from .schemas import ElevacionOut, PuntoLunar, VistaLunarOut, TerrenoOut
from .terreno import parche

cache: TTLCache = TTLCache(maxsize=256, ttl=3600)
FMT = "%Y-%m-%d %H:%M"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(headers={"User-Agent": "luna/1.0"})
    yield
    await app.state.http.aclose()


app = FastAPI(title="API Cielo Lunar", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


async def _obtener_elevacion(lat: float, lon: float) -> float:
    """Lee el DEM en un hilo aparte para no bloquear el servidor mientras espera la red."""
    try:
        return await run_in_threadpool(elevacion_m, lat, lon)
    except FueraDeCobertura as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DemNoDisponible as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/luna/terreno", response_model=TerrenoOut)
async def get_terreno(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radio_km: float = Query(10, gt=0, le=25, description="Radio del parche en km"),
    n: int = Query(129, ge=33, le=513, description="Puntos por lado de la malla"),
):
    try:
        return await run_in_threadpool(parche, lat, lon, radio_km, n)
    except FueraDeCobertura as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DemNoDisponible as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.get("/luna/elevacion", response_model=ElevacionOut)
async def get_elevacion(
    lat: float = Query(..., ge=-90, le=90, description="Latitud selenográfica"),
    lon: float = Query(..., ge=-180, le=180, description="Longitud selenográfica"),
):
    return ElevacionOut(lat=lat, lon=lon, elevacion_m=await _obtener_elevacion(lat, lon))


@app.get("/luna/cielo", response_model=VistaLunarOut)
async def cielo_lunar(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    alt_m: float | None = Query(None),
    fecha_inicio: date | None = Query(
        None,
        description="Fecha inicial local del período (YYYY-MM-DD)"
    ),
    fecha_fin: date | None = Query(
        None,
        description="Fecha final local del período (YYYY-MM-DD)"
    ),
    dias: int = Query(30, ge=1, le=60),
    paso: str = Query("1 h", pattern=r"^\d+ (m|h|d)$"),
    tz: str = Query("America/Bogota"),
):
    # Validar zona horaria.
    try:
        zona = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"Zona horaria inválida: {tz}"
        )

    # Las dos fechas deben enviarse juntas.
    if (fecha_inicio is None) != (fecha_fin is None):
        raise HTTPException(
            status_code=422,
            detail="Debes proporcionar fecha_inicio y fecha_fin."
        )

    # Determinar el intervalo temporal.
    if fecha_inicio is not None and fecha_fin is not None:

        if fecha_inicio > fecha_fin:
            raise HTTPException(
                status_code=422,
                detail="La fecha inicial no puede ser posterior a la final."
            )

        cantidad_dias = (fecha_fin - fecha_inicio).days + 1

        if cantidad_dias > 1460:
            raise HTTPException(
                status_code=422,
                detail="El período máximo permitido es de 4 años."
            )

        # Inicio del primer día en la zona horaria solicitada.
        inicio_local = datetime.combine(
            fecha_inicio,
            time.min,
            tzinfo=zona
        )

        # Final del último día seleccionado.
        fin_local = datetime.combine(
            fecha_fin,
            time(23, 59),
            tzinfo=zona
        )

        # Horizons recibe las fechas en UTC.
        inicio_dt = inicio_local.astimezone(timezone.utc)
        fin_dt = fin_local.astimezone(timezone.utc)

    else:
        # Compatibilidad con el funcionamiento anterior:
        # ventana de días desde el momento actual.
        inicio_dt = datetime.now(timezone.utc).replace(
            minute=0,
            second=0,
            microsecond=0
        )

        fin_dt = inicio_dt + timedelta(days=dias)

    inicio = inicio_dt.strftime(FMT)
    fin = fin_dt.strftime(FMT)

    # Obtener elevación.
    if alt_m is None:
        alt_m = await _obtener_elevacion(lat, lon)
        alt_origen = "dem"
    else:
        alt_origen = "usuario"

    # Clave de caché basada en todos los parámetros relevantes.
    clave = (
        lat,
        lon,
        round(alt_m, 1),
        inicio,
        fin,
        paso,
        tz,
    )

    if clave not in cache:
        try:
            cache[clave] = await tierra_y_sol_desde_luna(
                request.app.state.http,
                lat,
                lon,
                alt_m,
                inicio,
                fin,
                paso,
                tz,
            )

        except (HorizonError, ValueError, KeyError) as e:
            raise HTTPException(
                status_code=502,
                detail=str(e)
            )

    return VistaLunarOut(
        lat_luna=lat,
        lon_luna=lon,
        alt_m=alt_m,
        alt_origen=alt_origen,
        zona_horaria=tz,
        puntos=[
            PuntoLunar(**p)
            for p in cache[clave]
        ],
    )