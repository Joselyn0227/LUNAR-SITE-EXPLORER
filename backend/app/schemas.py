from pydantic import BaseModel

class PuntoHorizonte(BaseModel):
    azimut_deg: float
    elevacion_deg: float

class TerrenoOut(BaseModel):
    lat: float
    lon: float
    radio_km: float
    n: int                              # la malla es n x n
    celda_m: float                      # separación entre puntos, en metros
    centro_m: float                     # elevación del punto central
    elevaciones_m: list[float]          # n*n valores; filas de norte a sur, columnas de oeste a este
    horizonte: list[PuntoHorizonte]

class Astro(BaseModel):
    azimut_deg: float
    elevacion_deg:float
    visible: bool
    diametro_angular_arcsec: float
    distancia_km: float

class PuntoLunar(BaseModel):
    fecha_utc: str
    fecha_local: str
    tierra: Astro
    sol: Astro

class VistaLunarOut(BaseModel):
    lat_luna: float
    lon_luna: float
    alt_m: float
    alt_origen: str
    zona_horaria: str
    puntos: list[PuntoLunar]

class ElevacionOut(BaseModel):
    lat: float
    lon: float
    elevacion_m: float

