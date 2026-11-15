import os
import threading
from functools import lru_cache

import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform as transformar
from rasterio.windows import Window

# DEM fino: URL remota (prefijo /vsicurl/) o ruta local (.tif / .LBL)
DEM_PATH = os.getenv(
    "DEM_PATH",
    "/vsicurl/https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
)
# DEM grueso opcional (p. ej. LDEM_64.LBL), usado en parches de radio grande
DEM_PATH_GRUESO = os.getenv("DEM_PATH_GRUESO")

# Forzar la escala (ej. "0.5") si el archivo no la trae en sus metadatos
DEM_ESCALA = os.getenv("DEM_ESCALA")
DEM_ESCALA_GRUESO = os.getenv("DEM_ESCALA_GRUESO")

GDAL_OPTS = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.lbl,.LBL,.img,.IMG",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
}

# Esfera lunar de referencia, con lon/lat en grados
_CRS_LUNA = CRS.from_proj4("+proj=longlat +a=1737400 +b=1737400 +no_defs")

_lock = threading.Lock()
_abiertos: dict = {}


class FueraDeCobertura(Exception):
    pass


class DemNoDisponible(Exception):
    pass


def abrir(ruta: str):
    """Abre cada DEM una sola vez. Llamar con _lock tomado y dentro de rasterio.Env."""
    if ruta not in _abiertos:
        try:
            _abiertos[ruta] = rasterio.open(ruta)
        except Exception as e:  # errores de GDAL / red
            raise DemNoDisponible(f"No se pudo abrir el DEM ({ruta}): {e}")
    return _abiertos[ruta]


def escala_offset(ds, grueso: bool = False) -> tuple[float, float]:
    forzada = DEM_ESCALA_GRUESO if grueso else DEM_ESCALA
    if forzada is not None:
        return float(forzada), 0.0
    return (ds.scales[0] if ds.scales else 1.0), (ds.offsets[0] if ds.offsets else 0.0)


def a_dem(ds, lons: list[float], lats: list[float]) -> tuple[list[float], list[float]]:
    """Convierte lon/lat (grados, esfera lunar) a coordenadas (x, y) del CRS del DEM."""
    if ds.crs is None:
        raise DemNoDisponible("El DEM no tiene sistema de coordenadas (CRS)")

    if ds.crs.is_geographic:
        b = ds.bounds
        if b.left >= 0 and b.right > 180:            # DEM con longitudes 0..360
            lons = [l % 360 for l in lons]
        return list(lons), list(lats)

    # DEM proyectado: las coordenadas del archivo están en metros, no en grados
    try:
        xs, ys = transformar(_CRS_LUNA, ds.crs, lons, lats)
    except Exception as e:
        raise DemNoDisponible(f"No se pudo transformar coordenadas al CRS del DEM: {e}")
    return list(xs), list(ys)


@lru_cache(maxsize=4096)
def _elevacion(lat: float, lon: float) -> float:
    with _lock, rasterio.Env(**GDAL_OPTS):
        ds = abrir(DEM_PATH)
        (x,), (y,) = a_dem(ds, [lon], [lat])
        b = ds.bounds

        if not (b.bottom <= y <= b.top and b.left <= x <= b.right):
            raise FueraDeCobertura(f"({lat}, {lon}) fuera del DEM {tuple(b)}")

        fila, col = ds.index(x, y)
        fila = min(max(fila, 0), ds.height - 1)
        col = min(max(col, 0), ds.width - 1)

        try:
            dato = ds.read(1, window=Window(col, fila, 1, 1))[0, 0]
        except Exception as e:
            raise DemNoDisponible(f"Fallo al leer el DEM: {e}")

        if ds.nodata is not None and dato == ds.nodata:
            raise FueraDeCobertura("Sin dato en ese punto")

        escala, offset = escala_offset(ds)
        return float(dato) * escala + offset


def elevacion_m(lat: float, lon: float) -> float:
    """Elevación en metros respecto a la esfera de 1737.4 km. Longitud en -180..180."""
    return _elevacion(round(lat, 4), round(lon, 4))