import { useEffect, useMemo, useRef, useState } from "react";

import { Activity, Crosshair, LocateFixed, Minus, Plus } from "lucide-react";

import Moon3D, { type ZoomCmd } from "../../components/moon/MoonExplorer3D";

import MapaLunar2D from "../../components/moon/MapaLunar2D";

import SurfaceView3D, {
  type PuntoCielo,
  type TerrenoLunar,
} from "../../components/moon/SurfaceView3D";

import {
  formatoCoords,
  normalizarLon,
  type PuntoLibre,
} from "../../components/moon/coords";

import { exampleSites, type Zona } from "../../data/ExampleSites";

import DetailsPanel, {
  type DetailTab,
} from "../../features/demo/DetailsPanel/DetailsPanel";

import SitesPanel, {
  type SiteFilter,
} from "../../features/demo/SitesPanel/SitesPanel";

import ViewControls, {
  type MoonView,
} from "../../features/demo/ViewControls/ViewControls";

import { API_ROUTES } from "../../services/api";

import styles from "./Demo.module.css";

// ======================================================
// Configuración
// ======================================================

// Región de 50 km de diámetro.
const RADIO_TERRENO_KM = 25;

// Malla 257 × 257.
const RESOLUCION_TERRENO = 257;

const ZONA_HORARIA = "America/Bogota";

// ======================================================
// Tipos auxiliares
// ======================================================

interface ElevacionState {
  key: string;
  altura: number | null;
  cargada: boolean;
}

// ======================================================
// Utilidades
// ======================================================

function fechaLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [year, month, day] = fecha.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + dias);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function contarDiasIncluidos(inicio: string, fin: string): number {
  const [y1, m1, d1] = inicio.split("-").map(Number);
  const [y2, m2, d2] = fin.split("-").map(Number);

  const primero = Date.UTC(y1, m1 - 1, d1);
  const ultimo = Date.UTC(y2, m2 - 1, d2);

  return Math.floor((ultimo - primero) / 86_400_000) + 1;
}

function puntoComoZona(punto: PuntoLibre, altura: number | null): Zona {
  return {
    id: -1,
    nombre: "Punto personalizado",
    latitud: punto.lat,
    longitud_este: punto.lon < 0 ? punto.lon + 360 : punto.lon,
    tipo: "Coordenada",
    altura_m: altura ?? 0,
  };
}

function obtenerError(error: unknown, mensajePredeterminado: string): string {
  return error instanceof Error ? error.message : mensajePredeterminado;
}

// ======================================================
// Componente principal
// ======================================================

export default function Demo() {
  const hoy = fechaLocal(new Date());

  // --------------------------------------------------
  // Sitio seleccionado
  // --------------------------------------------------

  const [selectedId, setSelectedId] = useState(exampleSites.zonas[0].id);

  const [freePoint, setFreePoint] = useState<PuntoLibre | null>(null);

  const [freeElevation, setFreeElevation] = useState<ElevacionState | null>(
    null,
  );

  const freePointKey = freePoint
    ? `${freePoint.lat.toFixed(4)},${freePoint.lon.toFixed(4)}`
    : null;

  const freeElevationReady =
    !freePoint ||
    (freeElevation?.key === freePointKey && freeElevation.cargada);

  const freeHeight =
    freePoint && freeElevation?.key === freePointKey
      ? freeElevation.altura
      : null;

  const siteSelected =
    exampleSites.zonas.find((site) => site.id === selectedId) ??
    exampleSites.zonas[0];

  const selectedSite: Zona = freePoint
    ? puntoComoZona(freePoint, freeHeight)
    : siteSelected;

  const activeSiteId = freePoint ? null : selectedId;

  // --------------------------------------------------
  // Visualización
  // --------------------------------------------------

  const [filter, setFilter] = useState<SiteFilter>("site");

  const [view, setView] = useState<MoonView>("3D");

  const [ground, setGround] = useState(false);

  const [zoom, setZoom] = useState<ZoomCmd>({
    id: 0,
    factor: 1,
  });

  const [tab, setTab] = useState<DetailTab>("summary");

  // --------------------------------------------------
  // Tiempo
  // --------------------------------------------------

  const [fechaInicio, setFechaInicio] = useState(hoy);

  const [fechaFin, setFechaFin] = useState(sumarDias(hoy, 9));

  const [cielo, setCielo] = useState<{
    lat_luna: number;
    lon_luna: number;
    alt_m: number;
    alt_origen: string;
    zona_horaria: string;
    puntos: PuntoCielo[];
  } | null>(null);

  const [indiceTiempo, setIndiceTiempo] = useState(0);

  const [cargandoCielo, setCargandoCielo] = useState(false);

  const [errorCielo, setErrorCielo] = useState<string | null>(null);

  // --------------------------------------------------
  // Terreno
  // --------------------------------------------------

  const [terreno, setTerreno] = useState<TerrenoLunar | null>(null);

  const [cargandoTerreno, setCargandoTerreno] = useState(false);

  const [errorTerreno, setErrorTerreno] = useState<string | null>(null);

  // Caché limitada para evitar repetir descargas.
  const terrenoCache = useRef(new Map<string, TerrenoLunar>());

  // --------------------------------------------------
  // Coordenadas
  // --------------------------------------------------

  const latitud = selectedSite.latitud;

  const longitud = normalizarLon(selectedSite.longitud_este);

  // Los sitios predefinidos tienen elevación conocida.
  // Para los puntos libres se utiliza la obtenida por API.
  const altitud = freePoint ? (freeHeight ?? undefined) : selectedSite.altura_m;

  // --------------------------------------------------
  // Sitios visibles
  // --------------------------------------------------

  const sitiosFiltrados = useMemo(
    () =>
      exampleSites.zonas.filter(
        (site) => filter === "site" || site.tipo === filter,
      ),
    [filter],
  );

  // --------------------------------------------------
  // Consultar elevación de puntos libres
  // --------------------------------------------------

  useEffect(() => {
    if (!freePoint || !freePointKey) {
      setFreeElevation(null);
      return;
    }

    const controller = new AbortController();

    const punto = freePoint;
    const key = freePointKey;

    async function obtenerElevacion() {
      setFreeElevation({
        key,
        altura: null,
        cargada: false,
      });

      try {
        const url = API_ROUTES.ELEVACION(punto.lat, punto.lon);

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error al consultar elevación (${response.status}).`);
        }

        const data: { elevacion_m: number } = await response.json();

        if (!Number.isFinite(data.elevacion_m)) {
          throw new Error("La API no devolvió una elevación válida.");
        }

        setFreeElevation({
          key,
          altura: data.elevacion_m,
          cargada: true,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Error obteniendo elevación:", error);

        // Si falla esta consulta, /luna/cielo todavía
        // puede obtener la elevación directamente del DEM.
        setFreeElevation({
          key,
          altura: null,
          cargada: true,
        });
      }
    }

    obtenerElevacion();

    return () => controller.abort();
  }, [freePoint, freePointKey]);

  // --------------------------------------------------
  // Consultar cielo lunar
  // --------------------------------------------------

  useEffect(() => {
    if (!fechaInicio || !fechaFin) {
      setCielo(null);
      setCargandoCielo(false);
      setErrorCielo(null);
      return;
    }

    if (fechaInicio > fechaFin) {
      setCielo(null);
      setCargandoCielo(false);

      setErrorCielo("La fecha inicial no puede ser posterior a la final.");

      return;
    }

    const cantidadDias = contarDiasIncluidos(fechaInicio, fechaFin);

    if (cantidadDias > 60) {
      setCielo(null);
      setCargandoCielo(false);

      setErrorCielo("El rango máximo permitido es de 60 días.");

      return;
    }

    // Evita consultar el cielo antes de conocer
    // la altura de un punto personalizado.
    if (freePoint && !freeElevationReady) {
      setCielo(null);
      setCargandoCielo(false);
      setErrorCielo(null);
      return;
    }

    const controller = new AbortController();

    async function obtenerCielo() {
      try {
        setCargandoCielo(true);
        setErrorCielo(null);
        setCielo(null);
        setIndiceTiempo(0);

        const url = API_ROUTES.CIELO(
          latitud,
          longitud,
          fechaInicio,
          fechaFin,
          altitud,
          "1 h",
          ZONA_HORARIA,
        );

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text();

          throw new Error(
            `Error al consultar el cielo (${response.status}): ${detail}`,
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.puntos)) {
          throw new Error(
            "La respuesta de la API no contiene un arreglo de puntos.",
          );
        }

        setCielo(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Error obteniendo datos del cielo:", error);

        setCielo(null);

        setErrorCielo(
          obtenerError(error, "No se pudieron obtener los datos del cielo."),
        );
      } finally {
        if (!controller.signal.aborted) {
          setCargandoCielo(false);
        }
      }
    }

    obtenerCielo();

    return () => controller.abort();
  }, [
    latitud,
    longitud,
    altitud,
    fechaInicio,
    fechaFin,
    freePoint,
    freeElevationReady,
  ]);

  // --------------------------------------------------
  // Consultar terreno al entrar en la vista de superficie
  // --------------------------------------------------

  const necesitaTerreno = view === "superficie" || tab === "terrain";

  useEffect(() => {
    if (!necesitaTerreno) {
      setCargandoTerreno(false);
      return;
    }

    const key = [
      latitud.toFixed(4),
      longitud.toFixed(4),
      RADIO_TERRENO_KM,
      RESOLUCION_TERRENO,
    ].join(":");

    const cached = terrenoCache.current.get(key);

    if (cached) {
      setTerreno(cached);
      setCargandoTerreno(false);
      setErrorTerreno(null);
      return;
    }

    const controller = new AbortController();

    async function obtenerTerreno() {
      try {
        setTerreno(null);
        setCargandoTerreno(true);
        setErrorTerreno(null);

        const url = API_ROUTES.TERRENO(
          latitud,
          longitud,
          RADIO_TERRENO_KM,
          RESOLUCION_TERRENO,
        );

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text();

          throw new Error(
            `Error al consultar el terreno (${response.status}): ${detail}`,
          );
        }

        const data: TerrenoLunar = await response.json();

        if (
          !Array.isArray(data.elevaciones_m) ||
          data.elevaciones_m.length !== data.n * data.n
        ) {
          throw new Error("La API devolvió una malla de terreno incompleta.");
        }

        if (
          !Array.isArray(data.horizonte) ||
          !Number.isFinite(data.centro_m) ||
          !Number.isFinite(data.celda_m)
        ) {
          throw new Error(
            "La respuesta del DEM no contiene todos los datos necesarios.",
          );
        }

        // Mantener una caché pequeña para no acumular
        // grandes matrices de elevaciones en memoria.
        terrenoCache.current.set(key, data);

        if (terrenoCache.current.size > 4) {
          const primeraClave = terrenoCache.current.keys().next().value;

          if (primeraClave) {
            terrenoCache.current.delete(primeraClave);
          }
        }

        setTerreno(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Error obteniendo el terreno:", error);

        setTerreno(null);

        setErrorTerreno(
          obtenerError(error, "No se pudo cargar el terreno lunar."),
        );
      } finally {
        if (!controller.signal.aborted) {
          setCargandoTerreno(false);
        }
      }
    }

    obtenerTerreno();

    return () => controller.abort();
  }, [necesitaTerreno, latitud, longitud]);

  // --------------------------------------------------
  // Punto astronómico seleccionado
  // --------------------------------------------------

  const puntoActual = cielo?.puntos[indiceTiempo] ?? null;

  const fechaSeleccionada = puntoActual
    ? new Date(puntoActual.fecha_local).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin registro seleccionado";

  // --------------------------------------------------
  // Selección y filtros
  // --------------------------------------------------

  function handleSelectSite(id: number) {
    setFreePoint(null);
    setSelectedId(id);
  }

  function handleFilterChange(nextFilter: SiteFilter) {
    setFilter(nextFilter);

    const seleccionadoVisible = exampleSites.zonas.some(
      (site) =>
        site.id === selectedId &&
        (nextFilter === "site" || site.tipo === nextFilter),
    );

    if (!seleccionadoVisible) {
      const firstVisible = exampleSites.zonas.find(
        (site) => nextFilter === "site" || site.tipo === nextFilter,
      );

      if (firstVisible) {
        setSelectedId(firstVisible.id);
        setFreePoint(null);
      }
    }
  }

  // --------------------------------------------------
  // Zoom
  // --------------------------------------------------

  function zoomIn() {
    setZoom((previous) => ({
      id: previous.id + 1,
      factor: 1.25,
    }));
  }

  function zoomOut() {
    setZoom((previous) => ({
      id: previous.id + 1,
      factor: 0.8,
    }));
  }

  function zoomReset() {
    setZoom((previous) => ({
      id: previous.id + 1,
      factor: 1,
      reset: true,
    }));
  }

  // --------------------------------------------------
  // Renderizado
  // --------------------------------------------------

  return (
    <section className={styles.page} aria-labelledby="demo-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>CENTRO DE EXPLORACIÓN</span>

          <h1 id="demo-title">Lunar landing site navigator</h1>
        </div>

        <span className={styles.connection}>
          <span />
          API · DEM + HORIZONS
        </span>
      </div>

      {/* ============================================ */}
      {/* Estado de las consultas */}
      {/* ============================================ */}

      {cargandoCielo && (
        <p className={styles.status} role="status">
          Consultando posiciones del Sol y la Tierra...
        </p>
      )}

      {errorCielo && (
        <p className={styles.error} role="alert">
          {errorCielo}
        </p>
      )}

      {/* ============================================ */}
      {/* Datos astronómicos */}
      {/* ============================================ */}

      {puntoActual && (
        <section className={styles.skyData}>
          <div>
            <h3>Tierra</h3>

            <p>Azimut: {puntoActual.tierra.azimut_deg.toFixed(2)}°</p>

            <p>Elevación: {puntoActual.tierra.elevacion_deg.toFixed(2)}°</p>

            <p>
              Diámetro angular:{" "}
              {puntoActual.tierra.diametro_angular_arcsec.toFixed(1)}"
            </p>

            <p>
              Distancia:{" "}
              {puntoActual.tierra.distancia_km.toLocaleString("es-CO")} km
            </p>

            <p>
              {puntoActual.tierra.visible
                ? "Sobre el horizonte geométrico"
                : "Bajo el horizonte geométrico"}
            </p>
          </div>

          <div>
            <h3>Sol</h3>

            <p>Azimut: {puntoActual.sol.azimut_deg.toFixed(2)}°</p>

            <p>Elevación: {puntoActual.sol.elevacion_deg.toFixed(2)}°</p>

            <p>
              Diámetro angular:{" "}
              {puntoActual.sol.diametro_angular_arcsec.toFixed(1)}"
            </p>

            <p>
              Distancia: {puntoActual.sol.distancia_km.toLocaleString("es-CO")}{" "}
              km
            </p>

            <p>
              {puntoActual.sol.visible
                ? "Sobre el horizonte geométrico"
                : "Bajo el horizonte geométrico"}
            </p>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* Control temporal */}
      {/* ============================================ */}

      <div className={styles.timeControl}>
        <label>
          Fecha inicial
          <input
            type="date"
            value={fechaInicio}
            max={fechaFin || undefined}
            min={fechaFin ? sumarDias(fechaFin, -59) : undefined}
            onChange={(event) => setFechaInicio(event.target.value)}
          />
        </label>

        <label>
          Fecha final
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio || undefined}
            max={fechaInicio ? sumarDias(fechaInicio, 59) : undefined}
            onChange={(event) => setFechaFin(event.target.value)}
          />
        </label>

        <div className={styles.timeSlider}>
          <label htmlFor="time-range">Instante seleccionado</label>

          <input
            id="time-range"
            type="range"
            min={0}
            max={Math.max(0, (cielo?.puntos.length ?? 1) - 1)}
            step={1}
            value={indiceTiempo}
            disabled={!cielo || cielo.puntos.length === 0}
            onChange={(event) => setIndiceTiempo(Number(event.target.value))}
          />

          <span>{fechaSeleccionada}</span>
        </div>
      </div>

      {/* ============================================ */}
      {/* Espacio de trabajo */}
      {/* ============================================ */}

      <div className={styles.workspace}>
        <SitesPanel
          sites={sitiosFiltrados}
          selectedId={freePoint ? -1 : selectedId}
          filter={filter}
          onFormSubmit={(e) => {
            e.preventDefault();

            const formData = new FormData(e.currentTarget);

            const lat = Number(formData.get("lat"));
            const lon = Number(formData.get("lon"));

            // Validar coordenadas
            if (
              !Number.isFinite(lat) ||
              !Number.isFinite(lon) ||
              lat < -90 ||
              lat > 90 ||
              lon < -180 ||
              lon > 180
            ) {
              console.error("Las coordenadas introducidas no son válidas.");
              return;
            }

            // Registrar el punto personalizado
            const nuevoPunto: PuntoLibre = {
              lat,
              lon: normalizarLon(lon),
            };

            setFreePoint(nuevoPunto);
          }}
          onFilterChange={handleFilterChange}
          onSelect={handleSelectSite}
        />

        <section className={styles.mapPanel} aria-label="Visualización lunar">
          <div className={`${styles.map} ${ground ? styles.ground : ""}`}>
            <div className={styles.mapGrid} />

            <div className={styles.interactive}>
              {view === "3D" ? (
                <Moon3D
                  zonas={sitiosFiltrados}
                  selectedId={activeSiteId}
                  puntoLibre={freePoint}
                  onSelectSite={handleSelectSite}
                  zoom={zoom}
                />
              ) : view === "2D" ? (
                <MapaLunar2D
                  zonas={sitiosFiltrados}
                  selectedId={activeSiteId}
                  puntoLibre={freePoint}
                  onSelectSite={handleSelectSite}
                  onSelectPoint={setFreePoint}
                />
              ) : (
                <SurfaceView3D
                  terreno={terreno}
                  punto={puntoActual}
                  cargando={cargandoTerreno}
                  error={errorTerreno}
                  ground={ground}
                />
              )}
            </div>

            {/* ====================================== */}
            {/* Información superior */}
            {/* ====================================== */}

            <div className={styles.mapTopline}>
              <span>
                <Crosshair size={13} />

                {view === "3D"
                  ? "VISTA LUNAR · PUNTOS PRESELECCIONADOS"
                  : view === "2D"
                    ? "MAPA 2D · CLIC PARA ELEGIR"
                    : "VISTA DESDE LA SUPERFICIE LUNAR"}
              </span>

              <span>
                {formatoCoords(
                  selectedSite.latitud,
                  normalizarLon(selectedSite.longitud_este),
                )}
              </span>
            </div>

            {/* ====================================== */}
            {/* Brújula */}
            {/* ====================================== */}

            {view !== "superficie" && (
              <div className={styles.compass} aria-label="Orientación norte">
                <span>N</span>
                <i />
                <b />
              </div>
            )}

            {/* ====================================== */}
            {/* Zoom de la esfera lunar */}
            {/* ====================================== */}

            {view === "3D" && (
              <div
                className={styles.zoomControls}
                aria-label="Controles de zoom"
              >
                <button type="button" onClick={zoomIn} aria-label="Acercar">
                  <Plus size={16} />
                </button>

                <button type="button" onClick={zoomOut} aria-label="Alejar">
                  <Minus size={16} />
                </button>

                <button
                  type="button"
                  onClick={zoomReset}
                  aria-label="Restablecer zoom"
                >
                  <LocateFixed size={14} />
                </button>
              </div>
            )}

            {/* ====================================== */}
            {/* Controles de vista */}
            {/* ====================================== */}

            <ViewControls view={view} onViewChange={setView} />
          </div>
        </section>

        {/* ========================================== */}
        {/* Detalles del sitio */}
        {/* ========================================== */}

        <DetailsPanel
          site={selectedSite}
          tab={tab}
          onTabChange={setTab}
          puntos={cielo?.puntos ?? []}
          indiceTiempo={indiceTiempo}
          terreno={
            terreno &&
            Math.abs(terreno.lat - latitud) < 0.00001 &&
            Math.abs(normalizarLon(terreno.lon) - longitud) < 0.00001
              ? terreno
              : null
          }
          cargandoTerreno={cargandoTerreno}
          errorTerreno={errorTerreno}
        />
      </div>

      {/* ============================================ */}
      {/* Pie */}
      {/* ============================================ */}

      <div className={styles.footerLine}>
        <span>
          <Activity size={13} />
          {exampleSites.zonas.length} PUNTOS DE INTERÉS <br />
          (Preseleccionados, pero no precargados)
        </span>

        <span>
          {cielo
            ? `${cielo.puntos.length} REGISTROS ASTRONÓMICOS`
            : "ESPERANDO DATOS ASTRONÓMICOS"}
        </span>
      </div>
    </section>
  );
}
