from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import asyncio
import re

import httpx

URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
AU_KM = 149_597.7
MESES = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

TIERRA = "399"
SOL = "10"

class HorizonError(Exception):
    pass

def _params(objetivo, lat, lon, alt_m, inicio, fin, paso):
    return {
        "format": "json",
        "COMMAND": f"'{objetivo}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},{alt_m / 1000}'",
        "START_TIME": f"'{inicio}'",
        "STOP_TIME": f"'{fin}'",
        "STEP_SIZE": f"'{paso}'",
        "QUANTITIES": "'4,13,20'", # az/el, diametro angular, distancia
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'", 
        "TIME_DIGITS": "'MINUTES'",
        "CSV_FORMAT": "'YES'",
        "OBJ_DATA": "'NO'",
    }

def _norm(s: str) -> str:
    """Minúsculas y solo letras/dígitos: 'Elev_(a-app)' -> 'elevaapp'."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _parsear(texto: str) -> list[dict]:
    antes, resto = texto.split("$$SOE", 1)
    datos = resto.split("$$EOE", 1)[0].strip().splitlines()

    # El encabezado es la última línea no vacía antes de $$SOE (sin los "*****")
    lineas = [l for l in antes.splitlines() if l.strip() and not l.startswith("*")]
    cols = [c.strip() for c in lineas[-1].split(",")]

    filas = []
    for linea in datos:
        vals = [v.strip() for v in linea.split(",")]
        filas.append({c: v for c, v in zip(cols, vals) if c})  # ignora columnas sin nombre
    return filas


def _col(fila: dict, *prefijos: str) -> str:
    """Busca una columna por prefijo, ignorando mayúsculas, símbolos y caracteres ocultos."""
    buscados = [_norm(p) for p in prefijos]
    for k, v in fila.items():
        nk = _norm(k)
        if any(nk.startswith(b) for b in buscados):
            return v
    raise HorizonError(
        f"Columna no encontrada: {prefijos}. Disponibles: {[repr(k) for k in fila]}"
    )

def _parsear_fecha(texto: str) -> datetime:
    """Convierte '2026-Nov-14 19:00' en datetime UTC, sin depender del idioma del sistema."""
    anio, mes, dia_hora = texto.strip().split("-", 2)
    dia, hora = dia_hora.split()
    h, m = hora.split(":")[:2]
    return datetime(int(anio), MESES[mes.strip().title()], int(dia), int(h), int(m),
                    tzinfo=timezone.utc)


def _astro(fila: dict) -> dict:
    elev = float(_col(fila, "Elev"))
    return {
        "azumut_deg": float(_col(fila, "Azi")),
        "elevacion_deg": elev,
        "visible": elev > 0,
        "diametro_angular_arcsec": float(_col(fila, "Ang-diam")),
        "distancia_km": round(float(_col(fila, "delta")) * AU_KM, 1)
    }


async def _consultar(client: httpx.AsyncClient, params: dict) -> list[dict]:
    try:
        r = await client.get(URL, params=params, timeout=30)
    except httpx.HTTPError as e:
        raise HorizonError(f"No se pudo contactar a Horizons: {e}")

    if r.status_code != 200:
        raise HorizonError(f"Horizons respondio {r.status_code}")

    texto = r.json().get("result", "")
    if "$$SOE" not in texto:
        raise HorizonError(texto[:500])

    return _parsear(texto)

def _astro(fila: dict) -> dict:
    elev = float(_col(fila, "Elev"))
    return {
        "azimut_deg": float(_col(fila, "Azi")),
        "elevacion_deg": elev,
        "visible": elev > 0,
        "diametro_angular_arcsec": float(_col(fila, "Ang-diam")),
        "distancia_km": round(float(_col(fila, "delta")) * AU_KM, 1),
    }

async def tierra_y_sol_desde_luna(client: httpx.AsyncClient, lat: float, 
                                  lon: float, alt_m: float, inicio: str, fin: str, paso: str,
                                  tz_name: str
                                  ) -> list[dict]:
    filas_tierra, filas_sol = await asyncio.gather(
        _consultar(client, _params(TIERRA, lat, lon, alt_m, inicio, fin, paso)),
        _consultar(client, _params(SOL, lat, lon, alt_m, inicio, fin, paso)),   
    )

    if len(filas_tierra) != len(filas_sol):
        raise HorizonError("las rejillas de tiempo no coinciden")

    tz = ZoneInfo(tz_name)
    puntos =[]
    for ft, fs in zip(filas_tierra, filas_sol):
        dt = _parsear_fecha(_col(ft, "Date"))
        puntos.append({
            "fecha_utc": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "fecha_local": dt.astimezone(tz).isoformat(timespec="seconds"),
            "tierra": _astro(ft),
            "sol": _astro(fs),
        })
    return puntos