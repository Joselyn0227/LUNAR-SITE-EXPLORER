import math
from functools import lru_cache

import numpy as np
from rasterio import Env
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from . import dem
from .dem import DemNoDisponible, FueraDeCobertura

R_LUNA_M = 1_737_400.0
UMBRAL_GRUESO_KM = 25.0     # por encima de este radio se usa DEM_PATH_GRUESO, si está definido
MAX_PIXELES_LADO = 3000     # protección: no leer ventanas gigantes


def _leer(lat: float, lon: float, radio_km: float, n: int) -> tuple[np.ndarray, float]:
    if abs(lat) > 85:
        raise FueraDeCobertura("Cerca de los polos la malla lat/lon se deforma; use un DEM polar")

    grueso = bool(dem.DEM_PATH_GRUESO) and radio_km > UMBRAL_GRUESO_KM
    ruta = dem.DEM_PATH_GRUESO if grueso else dem.DEM_PATH

    radio_m = radio_km * 1000
    dlat = math.degrees(radio_m / R_LUNA_M)
    dlon = dlat / math.cos(math.radians(lat))   # los meridianos convergen hacia los polos

    with dem._lock, Env(**dem.GDAL_OPTS):
        ds = dem.abrir(ruta)
        b = ds.bounds

        # Las cuatro esquinas del parche, convertidas al CRS del DEM
        izq, der, abajo, arriba = lon - dlon, lon + dlon, lat - dlat, lat + dlat
        xs, ys = dem.a_dem(ds, [izq, der, izq, der], [abajo, abajo, arriba, arriba])

        if xs[0] >= xs[1] or xs[2] >= xs[3]:
            raise FueraDeCobertura(
                "El parche cruza el meridiano 0/180 del DEM; aún no soportado"
            )
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        if x0 < b.left or x1 > b.right or y0 < b.bottom or y1 > b.top:
            raise FueraDeCobertura(
                "El parche toca el borde del DEM (meridiano 0/180 o polo); aún no soportado"
            )

        # Tamaño de píxel en metros (en un DEM proyectado, res ya viene en metros)
        if ds.crs.is_geographic:
            pixel_m = math.radians(abs(ds.res[1])) * R_LUNA_M
        else:
            pixel_m = abs(ds.res[1])

        ventana = from_bounds(x0, y0, x1, y1, transform=ds.transform)
        if ventana.width > MAX_PIXELES_LADO or ventana.height > MAX_PIXELES_LADO:
            raise FueraDeCobertura(
                f"La ventana pedida ({ventana.width:.0f} x {ventana.height:.0f} px) es "
                "demasiado grande para este DEM; reduzca radio_km o use DEM_PATH_GRUESO"
            )

        celda = 2 * radio_m / n
        remuestreo = Resampling.average if celda > 1.5 * pixel_m else Resampling.bilinear
        try:
            datos = ds.read(1, window=ventana, out_shape=(n, n), resampling=remuestreo)
        except Exception as e:
            raise DemNoDisponible(f"Fallo al leer el DEM: {e}")
        escala, offset = dem.escala_offset(ds, grueso)
        nodata = ds.nodata

    z = datos.astype("float64")
    if nodata is not None:
        z[datos == nodata] = np.nan
    return z * escala + offset, pixel_m


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
    z, pixel_m = _leer(lat, lon, radio_km, n)
    z0 = z[(n - 1) // 2, (n - 1) // 2]
    if np.isnan(z0):
        raise FueraDeCobertura("Sin dato en el centro del parche")

    celda = 2 * radio_km * 1000 / n
    return {
        "lat": lat, "lon": lon, "radio_km": radio_km, "n": n,
        "celda_m": celda,
        "resolucion_dem_m": round(pixel_m, 1),
        "centro_m": round(float(z0), 1),
        "elevaciones_m": np.round(np.nan_to_num(z, nan=z0), 1).ravel().tolist(),
        "horizonte": _horizonte(z, celda),
    }


def parche(lat: float, lon: float, radio_km: float = 10.0, n: int = 129) -> dict:
    n = n if n % 2 else n + 1    # n impar: así el punto pedido queda en el centro exacto
    return _parche(round(lat, 4), round(lon, 4), round(radio_km, 2), n)