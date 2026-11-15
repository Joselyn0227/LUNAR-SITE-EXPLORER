from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
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
    app.state.http = httpx.AsyncClient(headers={"User-Agent": "meteolink-luna/1.0"})
    yield
    await app.state.http.aclose()


app = FastAPI(title="API Cielo Lunar", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # tu React en desarrollo
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
    lat: float = Query(..., ge=-90, le=90, description="Latitud selenográfica"),
    lon: float = Query(..., ge=-180, le=180, description="Longitud selenográfica"),
    alt_m: float | None = Query(None, description="Altitud en metros; si se omite, se toma del DEM"),
    dias: int = Query(30, ge=1, le=60, description="Ventana desde ahora"),
    paso: str = Query("1 h", pattern=r"^\d+ (m|h|d)$"),
    tz: str = Query("America/Bogota"),
):
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=422, detail=f"Zona horaria inválida: {tz}")

    if alt_m is None:
        alt_m = await _obtener_elevacion(lat, lon)
        alt_origen = "dem"
    else:
        alt_origen = "usuario"

    ahora = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    inicio = ahora.strftime(FMT)
    fin = (ahora + timedelta(days=dias)).strftime(FMT)

    clave = (lat, lon, round(alt_m, 1), inicio, fin, paso, tz)
    if clave not in cache:
        try:
            cache[clave] = await tierra_y_sol_desde_luna(
                request.app.state.http, lat, lon, alt_m, inicio, fin, paso, tz
            )
        except (HorizonError, ValueError, KeyError) as e:
            raise HTTPException(status_code=502, detail=str(e))

    return VistaLunarOut(
        lat_luna=lat, lon_luna=lon, alt_m=alt_m, alt_origen=alt_origen,
        zona_horaria=tz,
        puntos=[PuntoLunar(**p) for p in cache[clave]],
    )