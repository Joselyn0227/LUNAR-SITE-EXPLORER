import rasterio
from app import dem

with rasterio.Env(**dem.GDAL_OPTS), rasterio.open(dem.DEM_PATH) as ds:
    print("CRS:", ds.crs)
    print("geográfico:", ds.crs.is_geographic if ds.crs else None)
    print("bounds:", ds.bounds)
    print("res:", ds.res)
    print("tamaño:", ds.width, "x", ds.height)
    print("escala/offset:", ds.scales, ds.offsets, "nodata:", ds.nodata)
    print("bloques:", ds.block_shapes)