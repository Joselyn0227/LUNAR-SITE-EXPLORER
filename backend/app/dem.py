
import math
import os
import threading

from functools import lru_cache
from typing import Any, cast

import numpy as np
import rasterio

from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.env import Env
from rasterio.transform import from_bounds
from rasterio.warp import (
    reproject,
    transform as transformar,
)
from rasterio.windows import Window


# ======================================================
# CONFIGURACIÓN
# ======================================================

R_LUNA_M = 1_737_400.0

# Radio a partir del cual se prefiere el DEM grueso,
# siempre que esté configurado.
UMBRAL_GRUESO_KM = float(
    os.getenv("UMBRAL_GRUESO_KM", "20")
)

# Protección de memoria.
MAX_PIXELES_LADO = int(
    os.getenv("MAX_PIXELES_LADO", "3000")
)

# ======================================================
# DEM GLOBAL
# ======================================================

DEM_PATH = os.getenv(
    "DEM_PATH",
    "/vsicurl/https://planetarymaps.usgs.gov/mosaic/"
    "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
)

# ======================================================
# DEM POLARES
# ======================================================

DEM_PATH_POLAR_N = os.getenv(
    "DEM_PATH_POLAR_N",
    "/vsicurl/https://pgda.gsfc.nasa.gov/data/"
    "LOLA_20mpp_NP/LDEM_60N_120MPP_ADJ.TIF",
)

DEM_PATH_POLAR_S = os.getenv(
    "DEM_PATH_POLAR_S",
    "/vsicurl/https://pgda.gsfc.nasa.gov/data/"
    "LOLA_20mpp/LDEM_60S_120MPP_ADJ.TIF",
)

# ======================================================
# DEM GRUESO OPCIONAL
# ======================================================

DEM_PATH_GRUESO = os.getenv("DEM_PATH_GRUESO")

# ======================================================
# ESCALAS
# ======================================================

# Global LOLA: los valores originales requieren escala 0.5.
DEM_ESCALA = os.getenv("DEM_ESCALA")

DEM_ESCALA_GRUESO = os.getenv("DEM_ESCALA_GRUESO")

DEM_ESCALA_POLAR_N = os.getenv("DEM_ESCALA_POLAR_N")

DEM_ESCALA_POLAR_S = os.getenv("DEM_ESCALA_POLAR_S")

# ======================================================
# GDAL
# ======================================================

GDAL_OPTS = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": (
        ".tif,.TIF,.lbl,.LBL,.img,.IMG"
    ),
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
}

# ======================================================
# SISTEMA DE REFERENCIA LUNAR
# ======================================================

_CRS_LUNA = CRS.from_proj4(
    f"+proj=longlat "
    f"+R={R_LUNA_M} "
    "+no_defs +type=crs"
)

_lock = threading.RLock()

_abiertos: dict[str, rasterio.DatasetReader] = {}


# ======================================================
# EXCEPCIONES
# ======================================================

class FueraDeCobertura(Exception):
    pass


class DemNoDisponible(Exception):
    pass


# ======================================================
# UTILIDADES
# ======================================================

def normalizar_lon(lon: float) -> float:
    """
    Normaliza una longitud al intervalo [-180, 180).
    """

    return ((lon + 180) % 360) - 180


def validar_coordenadas(
    lat: float,
    lon: float,
) -> tuple[float, float]:

    if not math.isfinite(lat) or not math.isfinite(lon):
        raise ValueError("Las coordenadas deben ser números finitos.")

    if not -90 <= lat <= 90:
        raise ValueError("La latitud debe estar entre -90 y 90.")

    if not -180 <= lon <= 180:
        raise ValueError("La longitud debe estar entre -180 y 180.")

    return lat, normalizar_lon(lon)


# ======================================================
# GESTIÓN DE ARCHIVOS DEM
# ======================================================

def abrir(ruta: str):
    """
    Abre cada DEM una sola vez.

    Debe ejecutarse con el lock adquirido
    y dentro de rasterio.Env().
    """

    if not ruta:
        raise DemNoDisponible("Ruta DEM no configurada.")

    if ruta not in _abiertos:
        try:
            _abiertos[ruta] = rasterio.open(ruta)

        except Exception as e:
            raise DemNoDisponible(
                f"No se pudo abrir el DEM ({ruta}): {e}"
            ) from e

    return _abiertos[ruta]


def cerrar_dems():
    """
    Cierra las fuentes abiertas.

    Útil durante el apagado del backend.
    """

    with _lock:
        for ds in _abiertos.values():
            ds.close()

        _abiertos.clear()

        _elevacion.cache_clear()


# ======================================================
# ESCALA Y OFFSET
# ======================================================

def escala_offset(
    ds,
    fuente: str = "global",
) -> tuple[float, float]:

    escalas_forzadas = {
        "global": DEM_ESCALA,
        "grueso": DEM_ESCALA_GRUESO,
        "polar_norte": DEM_ESCALA_POLAR_N,
        "polar_sur": DEM_ESCALA_POLAR_S,
    }

    forzada = escalas_forzadas.get(fuente)

    if forzada is not None:
        return float(forzada), 0.0

    escala = ds.scales[0] if ds.scales else 1.0

    offset = ds.offsets[0] if ds.offsets else 0.0

    # El producto global LOLA de USGS tiene escala 0.5.
    if fuente == "global" and math.isclose(escala, 1.0):
        escala = 0.5

    return float(escala), float(offset)


# ======================================================
# TRANSFORMACIÓN A COORDENADAS DEL DEM
# ======================================================

def a_dem(
    ds,
    lons: list[float],
    lats: list[float],
) -> tuple[list[float], list[float]]:

    if ds.crs is None:
        raise DemNoDisponible(
            "El DEM no tiene sistema de coordenadas (CRS)."
        )

    lons = [normalizar_lon(lon) for lon in lons]

    if ds.crs.is_geographic:

        b = ds.bounds

        # DEM con longitudes 0..360.
        if b.left >= 0 and b.right > 180:
            lons = [lon % 360 for lon in lons]

        return list(lons), list(lats)

    try:
        coordenadas = transformar(
            _CRS_LUNA,
            ds.crs,
            lons,
            lats,
        )
        xs = coordenadas[0]
        ys = coordenadas[1]

    except Exception as e:
        raise DemNoDisponible(
            f"No se pudieron transformar las coordenadas: {e}"
        ) from e

    return list(xs), list(ys)


# ======================================================
# SELECCIÓN GEOGRÁFICA DEL DEM
# ======================================================

def _limites_latitud(
    lat: float,
    radio_km: float,
) -> tuple[float, float]:

    delta = math.degrees(
        radio_km * 1000 / R_LUNA_M
    )

    lat_min = max(-90.0, lat - delta)
    lat_max = min(90.0, lat + delta)

    return lat_min, lat_max


def seleccionar_dem(
    lat: float,
    radio_km: float,
) -> str:

    """
    Selecciona el DEM preferido.

    En parches que cruzan los límites de cobertura polar,
    se prefiere el DEM global.
    """

    lat_min, lat_max = _limites_latitud(
        lat,
        radio_km,
    )

    if lat_min >= 60 and DEM_PATH_POLAR_N:
        return DEM_PATH_POLAR_N

    if lat_max <= -60 and DEM_PATH_POLAR_S:
        return DEM_PATH_POLAR_S

    if (
        radio_km > UMBRAL_GRUESO_KM
        and DEM_PATH_GRUESO
    ):
        return DEM_PATH_GRUESO

    return DEM_PATH


def _fuentes_parche(
    lat: float,
    radio_km: float,
) -> list[tuple[str, str, bool]]:

    """
    Devuelve las fuentes que deben combinarse.

    El orden importa:

    1. DEM base.
    2. DEM global para completar huecos.
    3. DEM polar para sustituir los datos
       de su región de cobertura.
    """

    lat_min, lat_max = _limites_latitud(
        lat,
        radio_km,
    )

    fuentes: list[tuple[str, str, bool]] = []

    if radio_km > UMBRAL_GRUESO_KM and DEM_PATH_GRUESO is not None:
        fuentes.append(
            (DEM_PATH_GRUESO, "grueso", False)
        )

        fuentes.append(
            (DEM_PATH, "global", True)
        )

    else:
        fuentes.append(
            (DEM_PATH, "global", False)
        )

    # El parche alcanza la región polar norte.
    if lat_max >= 60 and DEM_PATH_POLAR_N:

        fuentes.append(
            (DEM_PATH_POLAR_N, "polar_norte", True)
        )

    # El parche alcanza la región polar sur.
    if lat_min <= -60 and DEM_PATH_POLAR_S:

        fuentes.append(
            (DEM_PATH_POLAR_S, "polar_sur", True)
        )

    # Evitar fuentes repetidas.
    resultado = []
    rutas_vistas = set()

    for ruta, nombre, opcional in fuentes:

        if ruta and ruta not in rutas_vistas:
            resultado.append(
                (ruta, nombre, opcional)
            )

            rutas_vistas.add(ruta)

    return resultado


# ======================================================
# PROYECCIÓN LOCAL
# ======================================================

def _crear_crs_local(
    lat: float,
    lon: float,
) -> CRS:

    """
    Crea una proyección Azimuthal Equidistant
    centrada en el punto solicitado.

    Las coordenadas resultantes están en metros.
    """

    return CRS.from_proj4(
        f"+proj=aeqd "
        f"+lat_0={lat} "
        f"+lon_0={lon} "
        f"+R={R_LUNA_M} "
        "+x_0=0 +y_0=0 "
        "+units=m +no_defs +type=crs"
    )


def _resolucion_pixel(
    ds,
    lat: float,
    fuente: str,
) -> float:

    """
    Estima la resolución espacial local en metros.

    Considera que los DEM globales cilíndricos
    reducen su escala horizontal hacia los polos.
    """

    rx = abs(float(ds.res[0]))
    ry = abs(float(ds.res[1]))

    if rx == 0 or ry == 0:
        raise DemNoDisponible(
            "El DEM tiene una resolución de píxel inválida."
        )

    if ds.crs.is_geographic:

        px = (
            R_LUNA_M
            * math.radians(rx)
            * max(abs(math.cos(math.radians(lat))), 1e-6)
        )

        py = R_LUNA_M * math.radians(ry)

        return math.sqrt(px * py)

    # Corrección para el DEM global equirectangular.
    proj = ds.crs.to_proj4().lower()

    if "+proj=eqc" in proj:

        rx *= max(
            abs(math.cos(math.radians(lat))),
            1e-6,
        )

    return math.sqrt(rx * ry)


# ======================================================
# REPROYECCIÓN DE UN DEM A LA MALLA LOCAL
# ======================================================

def _reproyectar_fuente(
    ds,
    fuente: str,
    lat: float,
    transform_local,
    crs_local: CRS,
    n: int,
    celda_m: float,
) -> tuple[np.ndarray, float]:

    if ds.crs is None:
        raise DemNoDisponible(
            "El DEM seleccionado no tiene CRS."
        )

    pixel_m = _resolucion_pixel(
        ds,
        lat,
        fuente,
    )

    # Si reducimos mucho la resolución, utilizamos average.
    # En los demás casos utilizamos interpolación bilineal.
    remuestreo = (
        Resampling.average
        if celda_m > 1.5 * pixel_m
        else Resampling.bilinear
    )

    destino = np.full(
        (n, n),
        np.nan,
        dtype=np.float32,
    )

    try:

        reproject(
            source=rasterio.band(ds, 1),

            destination=destino,

            src_transform=ds.transform,
            src_crs=ds.crs,
            src_nodata=ds.nodata,

            dst_transform=transform_local,
            dst_crs=crs_local,
            dst_nodata=np.nan,

            resampling=remuestreo,

            init_dest_nodata=True,

            num_threads=2,
            warp_mem_limit=128,
        )

    except Exception as e:

        raise DemNoDisponible(
            f"Error reproyectando {fuente}: {e}"
        ) from e

    escala, offset = escala_offset(
        ds,
        fuente,
    )

    # La transformación se realiza sobre los valores originales.
    destino = destino * escala + offset

    return destino, pixel_m


# ======================================================
# LEER PARCHE COMPLETO
# ======================================================

def leer_parche(
    lat: float,
    lon: float,
    radio_km: float,
    n: int,
) -> tuple[np.ndarray, float, float, str]:

    """
    Genera una cuadrícula local n x n.

    Devuelve:

    z:
        Elevaciones en metros.

    resolucion_m:
        Resolución efectiva aproximada de las fuentes.

    cobertura_pct:
        Porcentaje de celdas con datos válidos.

    modo_dem:
        Fuentes que contribuyeron a la malla.
    """

    lat, lon = validar_coordenadas(
        lat,
        lon,
    )

    if not math.isfinite(radio_km) or radio_km <= 0:
        raise ValueError(
            "El radio debe ser mayor que cero."
        )

    if n < 3 or n > MAX_PIXELES_LADO:
        raise ValueError(
            f"n debe estar entre 3 y {MAX_PIXELES_LADO}."
        )

    # La proyección local no debe alcanzar su antípoda.
    radio_m = radio_km * 1000

    if radio_m >= math.pi * R_LUNA_M * 0.45:
        raise ValueError(
            "El radio es demasiado grande para una "
            "proyección local AEQD."
        )

    celda_m = 2 * radio_m / n

    # Crear proyección local.
    crs_local = _crear_crs_local(
        lat,
        lon,
    )

    transform_local = from_bounds(
        -radio_m,
        -radio_m,
        radio_m,
        radio_m,
        n,
        n,
    )

    # Malla final.
    z = np.full(
        (n, n),
        np.nan,
        dtype=np.float32,
    )

    # Guarda cuál fuente proporcionó cada celda.
    propietario = np.full(
        (n, n),
        -1,
        dtype=np.int16,
    )

    fuentes = _fuentes_parche(
        lat,
        radio_km,
    )

    resoluciones = []
    errores = []

    # --------------------------------------------------
    # Lectura y combinación de las fuentes
    # --------------------------------------------------

    with _lock, Env(**GDAL_OPTS, aws_unsigned=False):

        for indice, (ruta, nombre, opcional) in enumerate(fuentes):

            try:

                ds = abrir(ruta)

                datos, pixel_m = _reproyectar_fuente(
                    ds=ds,
                    fuente=nombre,
                    lat=lat,
                    transform_local=transform_local,
                    crs_local=crs_local,
                    n=n,
                    celda_m=celda_m,
                )

            except Exception as e:

                errores.append(f"{nombre}: {e}")

                if opcional:
                    continue

                # Si falla el DEM base se intenta continuar
                # porque puede existir una fuente de respaldo.
                continue

            validos = np.isfinite(datos)

            if not validos.any():
                continue

            # Los DEM polares sustituyen al global
            # donde contienen datos válidos.
            if nombre in ("polar_norte", "polar_sur"):

                z[validos] = datos[validos]

                propietario[validos] = indice

            else:

                # Las fuentes globales y gruesas solo
                # completan las celdas todavía vacías.
                nuevos = validos & (propietario == -1)

                z[nuevos] = datos[nuevos]

                propietario[nuevos] = indice

            resoluciones.append(
                (pixel_m, nombre)
            )

    # --------------------------------------------------
    # Verificación de cobertura
    # --------------------------------------------------

    validos = np.isfinite(z)

    cobertura = float(
        validos.sum() / validos.size * 100
    )

    centro = n // 2

    if not validos[centro, centro]:

        raise FueraDeCobertura(
            "No hay datos de elevación para el "
            "centro del parche. "
            + " | ".join(errores)
        )

    if not validos.all():

        raise FueraDeCobertura(
            f"El DEM no cubre completamente el parche. "
            f"Cobertura: {cobertura:.2f}%. "
            "No se rellenarán los huecos con elevaciones "
            "inventadas."
        )

    # --------------------------------------------------
    # Identificar fuentes realmente utilizadas
    # --------------------------------------------------

    indices_usados = np.unique(
        propietario[propietario >= 0]
    )

    nombres_usados = [
        fuentes[int(i)][1]
        for i in indices_usados
    ]

    # Resolución efectiva ponderada por número de celdas.
    resolucion_total = 0.0
    cantidad_total = 0

    for indice in indices_usados:

        cantidad = int(
            np.sum(propietario == indice)
        )

        if cantidad == 0:
            continue

        nombre = fuentes[int(indice)][1]

        pixel = next(
            (
                resolucion
                for resolucion, fuente in resoluciones
                if fuente == nombre
            ),
            None,
        )

        if pixel is None:
            continue

        resolucion_total += pixel * cantidad
        cantidad_total += cantidad

    resolucion_efectiva = (
        resolucion_total / cantidad_total
        if cantidad_total
        else float("nan")
    )

    modo_dem = "+".join(nombres_usados)

    return (
        z,
        float(resolucion_efectiva),
        cobertura,
        modo_dem,
    )


# ======================================================
# ELEVACIÓN DE UN PUNTO
# ======================================================

def _leer_elevacion_fuente(
    lat: float,
    lon: float,
    ruta: str,
    fuente: str,
) -> float:

    with _lock, Env(**cast(dict[str, Any], GDAL_OPTS)):

        ds = abrir(ruta)

        (x,), (y,) = a_dem(
            ds,
            [lon],
            [lat],
        )

        b = ds.bounds

        if not (
            b.left <= x <= b.right
            and b.bottom <= y <= b.top
        ):

            raise FueraDeCobertura(
                f"El punto ({lat}, {lon}) está fuera de "
                f"la cobertura de {fuente}."
            )

        fila, col = ds.index(x, y)

        if not (
            0 <= fila < ds.height
            and 0 <= col < ds.width
        ):

            raise FueraDeCobertura(
                "El punto está fuera de los píxeles del DEM."
            )

        try:

            dato = ds.read(
                1,
                window=Window(
                    col,
                    fila,
                    1,
                    1,
                ),
            )[0, 0]

        except Exception as e:

            raise DemNoDisponible(
                f"Error leyendo elevación: {e}"
            ) from e

        if ds.nodata is not None:

            if np.isclose(dato, ds.nodata):
                raise FueraDeCobertura(
                    f"Sin datos de elevación en {fuente}."
                )

        if not np.isfinite(dato):

            raise FueraDeCobertura(
                f"Valor inválido en {fuente}."
            )

        escala, offset = escala_offset(
            ds,
            fuente,
        )

        return float(dato) * escala + offset


@lru_cache(maxsize=4096)
def _elevacion(
    lat: float,
    lon: float,
) -> float:

    # Primero se intenta el DEM regional cuando corresponde.
    fuentes = []

    if lat >= 60 and DEM_PATH_POLAR_N:

        fuentes.append(
            (DEM_PATH_POLAR_N, "polar_norte")
        )

    elif lat <= -60 and DEM_PATH_POLAR_S:

        fuentes.append(
            (DEM_PATH_POLAR_S, "polar_sur")
        )

    fuentes.append(
        (DEM_PATH, "global")
    )

    errores = []

    for ruta, nombre in fuentes:

        try:

            return _leer_elevacion_fuente(
                lat,
                lon,
                ruta,
                nombre,
            )

        except (FueraDeCobertura, DemNoDisponible) as e:

            errores.append(
                f"{nombre}: {e}"
            )

    raise FueraDeCobertura(
        "No fue posible obtener la elevación. "
        + " | ".join(errores)
    )


# ======================================================
# FUNCIÓN PÚBLICA
# ======================================================

def elevacion_m(
    lat: float,
    lon: float,
) -> float:

    """
    Elevación lunar en metros respecto a la esfera
    de referencia de 1737.4 km.

    Longitud de entrada: -180..180.
    """

    lat, lon = validar_coordenadas(
        lat,
        lon,
    )

    return _elevacion(
        round(lat, 5),
        round(lon, 5),
    )
