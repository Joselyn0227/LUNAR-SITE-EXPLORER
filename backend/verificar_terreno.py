"""Verifica el endpoint /luna/terreno con uvicorn corriendo.

Uso (desde la raíz del proyecto, con el entorno virtual activo):
    python verificar_terreno.py                                  # 3 puntos de prueba
    python verificar_terreno.py --lat 20.19 --lon 30.77 --radio 10   # un punto propio
"""
import argparse
import math
import sys
import time

import httpx

# (nombre, lat, lon, radio_km). Coordenadas de memoria: compruébalas si algo no cuadra.
PUNTOS = [
    ("Taurus-Littrow", 20.19, 30.77, 10.0),
    ("Aristarco", 23.7, -47.4, 25.0),
    ("Tycho", -43.31, -11.36, 50.0),
]
GRADIENTE = " .:-=+*#%@"   # de más bajo a más alto


def mapa_ascii(z: list[float], n: int, columnas: int = 56) -> str:
    zmin, zmax = min(z), max(z)
    rango = (zmax - zmin) or 1.0
    paso_c = max(1, n // columnas)
    paso_f = paso_c * 2     # los caracteres son ~2 veces más altos que anchos
    filas = []
    for f in range(0, n, paso_f):
        fila = ""
        for c in range(0, n, paso_c):
            v = z[f * n + c]
            fila += GRADIENTE[int((v - zmin) / rango * (len(GRADIENTE) - 1))]
        filas.append(fila)
    return "\n".join(filas)


def verificar(cliente: httpx.Client, base: str, nombre: str,
              lat: float, lon: float, radio: float, n_pedido: int) -> bool:
    print(f"\n=== {nombre} (lat={lat}, lon={lon}, radio={radio} km, n={n_pedido}) ===")

    inicio = time.perf_counter()
    try:
        r = cliente.get(
            f"{base}/luna/terreno",
            params={"lat": lat, "lon": lon, "radio_km": radio, "n": n_pedido},
        )
    except httpx.HTTPError as e:
        print(f"  FALLO  no se pudo conectar con {base}: {e}")
        return False
    print(f"  HTTP {r.status_code} en {time.perf_counter() - inicio:.1f} s")

    if r.status_code != 200:
        try:
            detalle = r.json().get("detail", r.text[:300])
        except ValueError:
            detalle = r.text[:300]
        print(f"  FALLO  {detalle}")
        return False

    d = r.json()
    ok = True

    faltan = [k for k in ("n", "celda_m", "centro_m", "elevaciones_m", "horizonte") if k not in d]
    if faltan:
        print(f"  FALLO  faltan campos en la respuesta: {faltan}")
        return False
    if "resolucion_dem_m" not in d:
        print("  AVISO  falta resolucion_dem_m (revisa TerrenoOut en schemas.py)")

    z: list[float] = d["elevaciones_m"]
    n: int = d["n"]

    if len(z) != n * n:
        print(f"  FALLO  se esperaban {n * n} elevaciones y llegaron {len(z)}")
        return False
    if not all(math.isfinite(v) for v in z):
        print("  FALLO  hay valores NaN o infinitos en la malla")
        return False
    print(f"  OK     malla de {n} x {n} = {len(z)} puntos")

    zmin, zmax = min(z), max(z)
    relieve = zmax - zmin
    print(f"  relieve: min {zmin:.0f} m, max {zmax:.0f} m, desnivel {relieve:.0f} m")
    print(f"  celda de la malla {d['celda_m']:.0f} m, DEM de {d.get('resolucion_dem_m', '?')} m")
    if relieve < 5:
        print("  AVISO  desnivel casi nulo: los datos son planos o la lectura del DEM falla")

    centro = z[((n - 1) // 2) * n + (n - 1) // 2]
    if abs(centro - d["centro_m"]) > 0.2:
        print(f"  FALLO  centro_m ({d['centro_m']}) no coincide con el centro de la malla ({centro})")
        ok = False

    hor = d["horizonte"]
    angulos = [p["elevacion_deg"] for p in hor]
    if not hor or any(not -90 <= a <= 90 for a in angulos):
        print("  FALLO  perfil de horizonte vacío o con ángulos fuera de rango")
        ok = False
    else:
        pico = max(hor, key=lambda p: p["elevacion_deg"])
        print(f"  OK     horizonte de {len(hor)} direcciones; el más alto: "
              f"{pico['elevacion_deg']:.1f} grados hacia el azimut {pico['azimut_deg']:.0f}")

    # Coherencia con el otro endpoint (distinto remuestreo, así que se tolera diferencia)
    try:
        e = cliente.get(f"{base}/luna/elevacion", params={"lat": lat, "lon": lon})
        if e.status_code == 200:
            valor = e.json()["elevacion_m"]
            dif = abs(valor - d["centro_m"])
            nivel = "OK   " if dif <= 100 else "AVISO"
            print(f"  {nivel}  /luna/elevacion = {valor:.0f} m, centro del parche = "
                  f"{d['centro_m']:.0f} m (diferencia {dif:.0f} m)")
        else:
            print(f"  AVISO  /luna/elevacion respondió {e.status_code}")
    except httpx.HTTPError as e:
        print(f"  AVISO  no se pudo consultar /luna/elevacion: {e}")

    print("\n  Mapa (norte arriba; ' ' = más bajo, '@' = más alto):")
    for linea in mapa_ascii(z, n).splitlines():
        print("  " + linea)

    print(f"\n  Resultado: {'OK' if ok else 'FALLO'}")
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description="Verifica /luna/terreno")
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--lat", type=float)
    ap.add_argument("--lon", type=float)
    ap.add_argument("--radio", type=float, default=10.0, help="solo con --lat/--lon")
    ap.add_argument("--n", type=int, default=129, help="puntos por lado de la malla")
    args = ap.parse_args()

    if (args.lat is None) != (args.lon is None):
        ap.error("--lat y --lon van juntos")

    if args.lat is not None:
        puntos = [("personalizado", args.lat, args.lon, args.radio)]
    else:
        puntos = PUNTOS

    # Timeout largo: la primera lectura remota de cada zona puede tardar
    with httpx.Client(timeout=300) as cliente:
        resultados = [
            verificar(cliente, args.url, nombre, lat, lon, radio, args.n)
            for nombre, lat, lon, radio in puntos
        ]

    print("\n" + ("Todo bien." if all(resultados) else "Hay fallos: revisa los mensajes de arriba."))
    sys.exit(0 if all(resultados) else 1)


if __name__ == "__main__":
    main()