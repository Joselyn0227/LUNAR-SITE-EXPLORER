import math
from functools import lru_cache

import numpy as np
from rasterio import Env
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from . import dem
from .dem import DemNoDisponible, FueraDeCobertura

R_LUNA_M = 1_737_400.0
UMBRAL_GRUESO_KM = 20.0     # por encima de este radio se usa DEM_PATH_GRUESO, si está definido
MAX_PIXELES_LADO = 3000     # protección: no leer ventanas gigantes


def _leer(
    lat: float,
    lon: float,
    radio_km: float,
    n: int,
) -> tuple[np.ndarray, float, float, str]:

    return dem.leer_parche(
        lat=lat,
        lon=lon,
        radio_km=radio_km,
        n=n,
    )


def _horizonte(z: np.ndarray, celda_m: float, paso_az: int = 5) -> list[dict]:
    n = z.shape[0]
    c = (n - 1) / 2
    z0 = z[int(c), int(c)]
    z = np.where(np.isnan(z), z0, z)

    # Distancias de muestreo hasta el borde del parche
    dist = np.arange(celda_m, c * celda_m, celda_m)
    salida = []
    for az in range(0, 360, paso_az):
        a = math.radians(az)                        # azimut desde el norte hacia el este
        col = np.clip(np.rint(c + dist * math.sin(a) / celda_m).astype(int), 0, n - 1)
        fila = np.clip(np.rint(c - dist * math.cos(a) / celda_m).astype(int), 0, n - 1)
        # El terreno lejano "cae" por la curvatura de la Luna: d² / (2R)
        altura = z[fila, col] - z0 - dist**2 / (2 * R_LUNA_M)
        ang = float(np.degrees(np.arctan2(altura, dist)).max())
        salida.append({"azimut_deg": float(az), "elevacion_deg": round(ang, 2)})
    return salida


@lru_cache(maxsize=32)
def _parche(lat: float, lon: float, radio_km: float, n: int) -> dict:
    z, pixel_m, cobertura_pct, modo_dem = _leer(
        lat,
        lon,
        radio_km,
        n,
    )
    z0 = z[(n - 1) // 2, (n - 1) // 2]
    if np.isnan(z0):
        raise FueraDeCobertura("Sin dato en el centro del parche")

    celda = 2 * radio_km * 1000 / n
    return {
        "lat": lat,
        "lon": lon,
        "radio_km": radio_km,
        "n": n,
        "celda_m": celda,
        "resolucion_dem_m": round(pixel_m, 1),
        "centro_m": round(float(z0), 1),
        "elevaciones_m": np.round(np.nan_to_num(z, nan=z0), 1).ravel().tolist(),
        "horizonte": _horizonte(z, celda),
        "cobertura_pct": round(cobertura_pct, 2),
        "modo_dem": modo_dem,
    }


def parche(lat: float, lon: float, radio_km: float = 10.0, n: int = 129) -> dict:
    n = n if n % 2 else n + 1    # n impar: así el punto pedido queda en el centro exacto
    return _parche(round(lat, 4), round(lon, 4), round(radio_km, 2), n)