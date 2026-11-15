
import { useMemo, useState } from "react";

import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Mountain,
  Sun,
  Wifi,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Zona } from "../../../data/ExampleSites";

import type {
  HorizonteData,
  PuntoCielo,
  TerrenoLunar,
} from "../../../components/moon/SurfaceView3D";

import styles from "./DetailsPanel.module.css";

// ======================================================
// Tipos
// ======================================================

export type DetailTab =
  | "summary"
  | "energy"
  | "communications"
  | "terrain";

interface DetailsPanelProps {
  site: Zona;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;

  puntos: PuntoCielo[];
  indiceTiempo: number;

  terreno: TerrenoLunar | null;
  cargandoTerreno?: boolean;
  errorTerreno?: string | null;
}

interface RegistroAnalizado {
  timestamp: number;
  hora: string;

  solElevacion: number;
  solAzimut: number;
  solVisible: boolean;
  solVisibleValor: number;
  horizonteSol: number | null;

  tierraElevacion: number;
  tierraAzimut: number;
  tierraVisible: boolean;
  tierraVisibleValor: number;
  horizonteTierra: number | null;

  distanciaTierra: number;
  retardoSeg: number;
  retardoIdaVueltaSeg: number;
}

interface Estadisticas {
  minimo: number;
  maximo: number;
  promedio: number;
  desviacion: number;
}

// ======================================================
// Configuración
// ======================================================

const VELOCIDAD_LUZ_KM_S = 299792.458;

const tabs: { value: DetailTab; label: string }[] = [
  { value: "summary", label: "Resumen" },
  { value: "energy", label: "Energía" },
  { value: "communications", label: "Comunicaciones" },
  { value: "terrain", label: "Terreno" },
];

// ======================================================
// Utilidades
// ======================================================

function normalizarAzimut(azimut: number): number {
  return ((azimut % 360) + 360) % 360;
}

function formatoNumero(
  value: number | null | undefined,
  decimales = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatoFecha(fecha: string): string {
  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return fecha;
  }

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerHorizonte(
  azimut: number,
  perfil: HorizonteData[],
): number | null {
  const validos = perfil
    .filter(
      (punto) =>
        Number.isFinite(punto.azimut_deg) &&
        Number.isFinite(punto.elevacion_deg),
    )
    .map((punto) => ({
      azimut_deg: normalizarAzimut(punto.azimut_deg),
      elevacion_deg: punto.elevacion_deg,
    }))
    .sort((a, b) => a.azimut_deg - b.azimut_deg);

  if (validos.length === 0) {
    return null;
  }

  const objetivo = normalizarAzimut(azimut);

  if (validos.length === 1) {
    return validos[0].elevacion_deg;
  }

  // Punto inferior y superior para interpolación circular.
  const inferior =
    [...validos].reverse().find((punto) => punto.azimut_deg <= objetivo) ??
    validos[validos.length - 1];

  const superior =
    validos.find((punto) => punto.azimut_deg > objetivo) ??
    validos[0];

  let azimutInferior = inferior.azimut_deg;
  let azimutSuperior = superior.azimut_deg;
  let azimutObjetivo = objetivo;

  // Resolver el paso entre 360° y 0°.
  if (azimutSuperior <= azimutInferior) {
    azimutSuperior += 360;
  }

  if (azimutObjetivo < azimutInferior) {
    azimutObjetivo += 360;
  }

  const diferencia = azimutSuperior - azimutInferior;

  if (diferencia === 0) {
    return inferior.elevacion_deg;
  }

  const proporcion =
    (azimutObjetivo - azimutInferior) / diferencia;

  return (
    inferior.elevacion_deg +
    proporcion *
      (superior.elevacion_deg - inferior.elevacion_deg)
  );
}

function esVisibleLocal(
  visibleAstronomicamente: boolean,
  elevacion: number,
  horizonte: number | null,
): boolean {
  if (!visibleAstronomicamente) {
    return false;
  }

  // Sin perfil topográfico disponible, se utiliza
  // exclusivamente la visibilidad astronómica.
  if (horizonte === null) {
    return visibleAstronomicamente;
  }

  return elevacion > horizonte;
}

function calcularEstadisticas(valores: number[]): Estadisticas | null {
  const validos = valores.filter(Number.isFinite);

  if (validos.length === 0) {
    return null;
  }

  const minimo = Math.min(...validos);
  const maximo = Math.max(...validos);

  const promedio =
    validos.reduce((total, valor) => total + valor, 0) /
    validos.length;

  const varianza =
    validos.reduce(
      (total, valor) => total + Math.pow(valor - promedio, 2),
      0,
    ) / validos.length;

  return {
    minimo,
    maximo,
    promedio,
    desviacion: Math.sqrt(varianza),
  };
}

function calcularPorcentajePeriodo(
  registros: RegistroAnalizado[],
  selector: (registro: RegistroAnalizado) => boolean,
): number | null {
  const ordenados = registros
    .filter((registro) => Number.isFinite(registro.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (ordenados.length < 2) {
    return null;
  }

  let tiempoTotal = 0;
  let tiempoActivo = 0;

  // Cada registro representa la condición hasta
  // el siguiente instante muestreado.
  for (let i = 0; i < ordenados.length - 1; i++) {
    const actual = ordenados[i];
    const siguiente = ordenados[i + 1];

    const intervalo = siguiente.timestamp - actual.timestamp;

    if (intervalo <= 0) {
      continue;
    }

    tiempoTotal += intervalo;

    if (selector(actual)) {
      tiempoActivo += intervalo;
    }
  }

  if (tiempoTotal === 0) {
    return null;
  }

  return (tiempoActivo / tiempoTotal) * 100;
}

// ======================================================
// Análisis del terreno
// ======================================================

function analizarTerreno(terreno: TerrenoLunar | null) {
  if (!terreno || terreno.n <= 0) {
    return null;
  }

  const { n, elevaciones_m, celda_m } = terreno;

  if (
    elevaciones_m.length !== n * n ||
    !Number.isFinite(celda_m) ||
    celda_m <= 0
  ) {
    return null;
  }

  const elevaciones = elevaciones_m.filter(Number.isFinite);

  if (elevaciones.length === 0) {
    return null;
  }

  const estadisticas = calcularEstadisticas(elevaciones);

  if (!estadisticas) {
    return null;
  }

  const pendientes: number[] = [];

  // Derivadas centrales para estimar la pendiente.
  for (let fila = 1; fila < n - 1; fila++) {
    for (let columna = 1; columna < n - 1; columna++) {
      const centro = elevaciones_m[fila * n + columna];

      const oeste = elevaciones_m[fila * n + columna - 1];
      const este = elevaciones_m[fila * n + columna + 1];

      const norte = elevaciones_m[(fila - 1) * n + columna];
      const sur = elevaciones_m[(fila + 1) * n + columna];

      if (
        !Number.isFinite(centro) ||
        !Number.isFinite(oeste) ||
        !Number.isFinite(este) ||
        !Number.isFinite(norte) ||
        !Number.isFinite(sur)
      ) {
        continue;
      }

      const dx = (este - oeste) / (2 * celda_m);
      const dy = (sur - norte) / (2 * celda_m);

      const pendiente =
        Math.atan(Math.hypot(dx, dy)) * (180 / Math.PI);

      pendientes.push(pendiente);
    }
  }

  const estadisticasPendiente =
    calcularEstadisticas(pendientes);

  const centro = Math.floor(n / 2);

  // Corte norte-sur: columna central.
  // Corte oeste-este: fila central.
  const perfiles = Array.from({ length: n }, (_, indice) => {
    const distancia =
      ((indice - centro) * celda_m) / 1000;

    return {
      distancia_km: Number(distancia.toFixed(3)),

      norteSur:
        elevaciones_m[indice * n + centro] ?? null,

      oesteEste:
        elevaciones_m[centro * n + indice] ?? null,
    };
  });

  const horizonte = terreno.horizonte
    .filter(
      (punto) =>
        Number.isFinite(punto.azimut_deg) &&
        Number.isFinite(punto.elevacion_deg),
    )
    .map((punto) => ({
      azimut: normalizarAzimut(punto.azimut_deg),
      obstaculo: punto.elevacion_deg,
    }))
    .sort((a, b) => a.azimut - b.azimut);

  return {
    ...estadisticas,

    rango: estadisticas.maximo - estadisticas.minimo,

    pendienteMedia:
      estadisticasPendiente?.promedio ?? null,

    pendienteMaxima:
      estadisticasPendiente?.maximo ?? null,

    perfiles,
    horizonte,
  };
}

// ======================================================
// Componente
// ======================================================

export default function DetailsPanel({
  site,
  tab,
  onTabChange,
  puntos,
  indiceTiempo,
  terreno,
  cargandoTerreno = false,
  errorTerreno = null,
}: DetailsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const hayHorizonte = Boolean(
    terreno?.horizonte && terreno.horizonte.length > 0,
  );

  // --------------------------------------------------
  // Preparar registros astronómicos
  // --------------------------------------------------

  const registros = useMemo<RegistroAnalizado[]>(() => {
    return puntos?.map((punto) => {
      const horizonteSol = hayHorizonte && terreno
        ? obtenerHorizonte(punto.sol.azimut_deg, terreno.horizonte)
        : null;

      const horizonteTierra = hayHorizonte && terreno
        ? obtenerHorizonte(punto.tierra.azimut_deg, terreno.horizonte)
        : null;

      const solVisible = esVisibleLocal(
        punto.sol.visible,
        punto.sol.elevacion_deg,
        horizonteSol,
      );

      const tierraVisible = esVisibleLocal(
        punto.tierra.visible,
        punto.tierra.elevacion_deg,
        horizonteTierra,
      );

      const distanciaTierra = punto.tierra.distancia_km;

      const retardoSeg =
        distanciaTierra / VELOCIDAD_LUZ_KM_S;

      const timestamp = Date.parse(punto.fecha_utc);

      return {
        timestamp,
        hora: formatoFecha(punto.fecha_local),

        solElevacion: punto.sol.elevacion_deg,
        solAzimut: punto.sol.azimut_deg,
        solVisible,
        solVisibleValor: solVisible ? 1 : 0,
        horizonteSol,

        tierraElevacion: punto.tierra.elevacion_deg,
        tierraAzimut: punto.tierra.azimut_deg,
        tierraVisible,
        tierraVisibleValor: tierraVisible ? 1 : 0,
        horizonteTierra,

        distanciaTierra,

        retardoSeg,
        retardoIdaVueltaSeg: retardoSeg * 2,
      };
    });
  }, [puntos, terreno, hayHorizonte]);

  // --------------------------------------------------
  // Registro seleccionado
  // --------------------------------------------------

  const actual =
    registros[indiceTiempo] ?? registros[0] ?? null;

  // --------------------------------------------------
  // Estadísticas del periodo
  // --------------------------------------------------

  const estadisticasSol = useMemo(
    () =>
      calcularEstadisticas(
        registros.map((registro) => registro.solElevacion),
      ),
    [registros],
  );

  const estadisticasDistancia = useMemo(
    () =>
      calcularEstadisticas(
        registros.map((registro) => registro.distanciaTierra),
      ),
    [registros],
  );

  const porcentajeSol = useMemo(
    () =>
      calcularPorcentajePeriodo(
        registros,
        (registro) => registro.solVisible,
      ),
    [registros],
  );

  const porcentajeTierra = useMemo(
    () =>
      calcularPorcentajePeriodo(
        registros,
        (registro) => registro.tierraVisible,
      ),
    [registros],
  );

  // --------------------------------------------------
  // Estadísticas del terreno
  // --------------------------------------------------

  const analisisTerreno = useMemo(
    () => analizarTerreno(terreno),
    [terreno],
  );

  const etiquetaVisibilidad = hayHorizonte
    ? "Corregida por obstáculos"
    : "Visibilidad geométrica";

  const porcentajeTexto = (valor: number | null) =>
    valor === null ? "—" : `${formatoNumero(valor)} %`;

  // --------------------------------------------------
  // Renderizado
  // --------------------------------------------------

  return (
    <aside
      className={styles.panel}
      aria-label={`Detalles de ${site.nombre}`}
    >
      <header className={styles.siteHeader}>

        <div className={styles.titleCopy}>
          <span className={styles.eyebrow}>
            SITIO DE EXPLORACIÓN
          </span>

          <h2>{site.nombre}</h2>

          <p>
            {formatoNumero(site.latitud, 4)}° lat.
            {" · "}
            {formatoNumero(site.longitud_este, 4)}° long. E
          </p>

          <p>
            Elevación: {formatoNumero(site.altura_m, 0)} m
          </p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Información del sitio">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.value}
            className={tab === item.value ? styles.tabActive : ""}
            onClick={() => onTabChange(item.value)}
            aria-current={
              tab === item.value ? "page" : undefined
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        {/* ========================================== */}
        {/* RESUMEN */}
        {/* ========================================== */}

        {tab === "summary" && (
          <>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Sun size={15} />
                <h3>Condiciones solares</h3>
              </div>

              <div className={styles.metricsGrid}>
                <article className={styles.metricCard}>
                  <span>Disponibilidad solar</span>

                  <strong>
                    {porcentajeTexto(porcentajeSol)}
                  </strong>

                  <small>
                    Del intervalo analizado
                  </small>
                </article>

                <article className={styles.metricCard}>
                  <span>Elevación actual</span>

                  <strong>
                    {actual
                      ? `${formatoNumero(actual.solElevacion)}°`
                      : "—"}
                  </strong>

                  <small>
                    Máximo:{" "}
                    {estadisticasSol
                      ? `${formatoNumero(estadisticasSol.maximo)}°`
                      : "—"}
                  </small>
                </article>
              </div>

              <div className={styles.metricRow}>
                <span>Azimut solar</span>

                <strong>
                  {actual
                    ? `${formatoNumero(actual.solAzimut)}°`
                    : "—"}
                </strong>
              </div>

              <div className={styles.metricRow}>
                <span>Estado de iluminación</span>

                <strong
                  className={
                    actual?.solVisible
                      ? styles.statusGood
                      : styles.statusBad
                  }
                >
                  {actual
                    ? actual.solVisible
                      ? "Visible"
                      : "Sin visibilidad"
                    : "Sin datos"}
                </strong>
              </div>
            </section>

            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Globe2 size={15} />
                <h3>Comunicaciones con la Tierra</h3>
              </div>

              <div className={styles.metricsGrid}>
                <article className={styles.metricCard}>
                  <span>Disponibilidad del enlace</span>

                  <strong>
                    {porcentajeTexto(porcentajeTierra)}
                  </strong>

                  <small>
                    Del intervalo analizado
                  </small>
                </article>

                <article className={styles.metricCard}>
                  <span>Distancia actual</span>

                  <strong>
                    {actual
                      ? `${formatoNumero(actual.distanciaTierra, 0)} km`
                      : "—"}
                  </strong>

                  <small>
                    Distancia geocéntrica reportada
                  </small>
                </article>
              </div>

              <div className={styles.metricRow}>
                <span>Retraso de propagación (ida)</span>

                <strong>
                  {actual
                    ? `${formatoNumero(actual.retardoSeg, 3)} s`
                    : "—"}
                </strong>
              </div>

              <div className={styles.metricRow}>
                <span>Retraso de propagación (ida y vuelta)</span>

                <strong>
                  {actual
                    ? `${formatoNumero(
                        actual.retardoIdaVueltaSeg,
                        3,
                      )} s`
                    : "—"}
                </strong>
              </div>

              <div className={styles.metricRow}>
                <span>Elevación de la Tierra</span>

                <strong>
                  {actual
                    ? `${formatoNumero(actual.tierraElevacion)}°`
                    : "—"}
                </strong>
              </div>
            </section>

            <section className={styles.evaluation}>
              <div className={styles.evaluationTitle}>
                <h3>Indicadores del sitio</h3>

                <span>
                  <Check size={12} />
                  DATOS
                </span>
              </div>

              <div className={styles.indicatorRow}>
                <span>Disponibilidad solar</span>

                <strong>
                  {porcentajeTexto(porcentajeSol)}
                </strong>
              </div>

              <div className={styles.indicatorRow}>
                <span>Disponibilidad de comunicaciones</span>

                <strong>
                  {porcentajeTexto(porcentajeTierra)}
                </strong>
              </div>

              <div className={styles.indicatorRow}>
                <span>Desnivel regional</span>

                <strong>
                  {analisisTerreno
                    ? `${formatoNumero(analisisTerreno.rango, 0)} m`
                    : "Sin datos"}
                </strong>
              </div>

              <p className={styles.description}>
                Estos indicadores se presentan por separado.
                No se calcula una puntuación global porque todavía
                no se han definido los requisitos ni las prioridades
                de una misión de aterrizaje.
              </p>
            </section>
          </>
        )}

        {/* ========================================== */}
        {/* ENERGÍA */}
        {/* ========================================== */}

        {tab === "energy" && (
          <>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Sun size={15} />
                <h3>Potencial de iluminación solar</h3>
              </div>

              <div className={styles.primaryValue}>
                {porcentajeTexto(porcentajeSol)}
                <small>Disponibilidad solar estimada</small>
              </div>

              <div className={styles.metricsGrid}>
                <article className={styles.metricCard}>
                  <span>Elevación máxima</span>

                  <strong>
                    {estadisticasSol
                      ? `${formatoNumero(estadisticasSol.maximo)}°`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Elevación promedio</span>

                  <strong>
                    {estadisticasSol
                      ? `${formatoNumero(estadisticasSol.promedio)}°`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Elevación mínima</span>

                  <strong>
                    {estadisticasSol
                      ? `${formatoNumero(estadisticasSol.minimo)}°`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Desviación estándar</span>

                  <strong>
                    {estadisticasSol
                      ? `${formatoNumero(estadisticasSol.desviacion)}°`
                      : "—"}
                  </strong>
                </article>
              </div>
            </section>

            <section className={styles.chartSection}>
              <div className={styles.chartHeading}>
                <h3>Elevación solar</h3>
                <span>Grados</span>
              </div>

              {registros.length > 0 ? (
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={registros}
                      margin={{
                        top: 10,
                        right: 8,
                        bottom: 5,
                        left: -15,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="hora"
                        minTickGap={30}
                        tick={{ fontSize: 10 }}
                      />

                      <YAxis
                        unit="°"
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip />

                      <ReferenceLine
                        y={0}
                        stroke="#d18b45"
                        strokeDasharray="4 4"
                      />

                      <Line
                        type="monotone"
                        dataKey="solElevacion"
                        name="Elevación del Sol"
                        stroke="#d9a441"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />

                      {registros.length > 12 && (
                        <Brush
                          dataKey="hora"
                          height={20}
                          travellerWidth={8}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay registros astronómicos disponibles.
                </p>
              )}
            </section>

            <section className={styles.chartSection}>
              <div className={styles.chartHeading}>
                <h3>Periodos de iluminación</h3>
                <span>Visible / Oculto</span>
              </div>

              {registros.length > 0 ? (
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart
                      data={registros}
                      margin={{
                        top: 10,
                        right: 8,
                        bottom: 5,
                        left: -15,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="hora"
                        minTickGap={30}
                        tick={{ fontSize: 10 }}
                      />

                      <YAxis
                        domain={[0, 1]}
                        ticks={[0, 1]}
                        tickFormatter={(value) =>
                          value === 1 ? "Sí" : "No"
                        }
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip />

                      <Area
                        type="stepAfter"
                        dataKey="solVisibleValor"
                        name="Sol visible"
                        stroke="#d9a441"
                        fill="#d9a441"
                        fillOpacity={0.22}
                      />

                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay datos para representar.
                </p>
              )}
            </section>

            <p className={styles.description}>
              La disponibilidad solar se calcula utilizando la
              visibilidad de cada registro. Cuando se dispone del
              perfil topográfico, también se consideran los obstáculos
              del horizonte local. No representa irradiancia solar
              ni energía eléctrica generada.
            </p>
          </>
        )}

        {/* ========================================== */}
        {/* COMUNICACIONES */}
        {/* ========================================== */}

        {tab === "communications" && (
          <>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Wifi size={15} />
                <h3>Enlace con la Tierra</h3>
              </div>

              <div className={styles.primaryValue}>
                {porcentajeTexto(porcentajeTierra)}
                <small>Disponibilidad geométrica/topográfica</small>
              </div>

              <div className={styles.metricsGrid}>
                <article className={styles.metricCard}>
                  <span>Distancia mínima</span>

                  <strong>
                    {estadisticasDistancia
                      ? `${formatoNumero(
                          estadisticasDistancia.minimo,
                          0,
                        )} km`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Distancia máxima</span>

                  <strong>
                    {estadisticasDistancia
                      ? `${formatoNumero(
                          estadisticasDistancia.maximo,
                          0,
                        )} km`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Distancia promedio</span>

                  <strong>
                    {estadisticasDistancia
                      ? `${formatoNumero(
                          estadisticasDistancia.promedio,
                          0,
                        )} km`
                      : "—"}
                  </strong>
                </article>

                <article className={styles.metricCard}>
                  <span>Elevación actual</span>

                  <strong>
                    {actual
                      ? `${formatoNumero(
                          actual.tierraElevacion,
                        )}°`
                      : "—"}
                  </strong>
                </article>
              </div>

              <div className={styles.metricRow}>
                <span>Azimut de la Tierra</span>

                <strong>
                  {actual
                    ? `${formatoNumero(actual.tierraAzimut)}°`
                    : "—"}
                </strong>
              </div>

              <div className={styles.metricRow}>
                <span>Estado del enlace visual</span>

                <strong
                  className={
                    actual?.tierraVisible
                      ? styles.statusGood
                      : styles.statusBad
                  }
                >
                  {actual
                    ? actual.tierraVisible
                      ? "Visible"
                      : "Obstruido / bajo el horizonte"
                    : "Sin datos"}
                </strong>
              </div>
            </section>

            <section className={styles.chartSection}>
              <div className={styles.chartHeading}>
                <h3>Elevación de la Tierra</h3>
                <span>Grados</span>
              </div>

              {registros.length > 0 ? (
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={registros}
                      margin={{
                        top: 10,
                        right: 8,
                        bottom: 5,
                        left: -15,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="hora"
                        minTickGap={30}
                        tick={{ fontSize: 10 }}
                      />

                      <YAxis
                        unit="°"
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip />

                      <ReferenceLine
                        y={0}
                        stroke="#d18b45"
                        strokeDasharray="4 4"
                      />

                      <Line
                        type="monotone"
                        dataKey="tierraElevacion"
                        name="Elevación de la Tierra"
                        stroke="#65a9cf"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />

                      {registros.length > 12 && (
                        <Brush
                          dataKey="hora"
                          height={20}
                          travellerWidth={8}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay registros para representar.
                </p>
              )}
            </section>

            <section className={styles.chartSection}>
              <div className={styles.chartHeading}>
                <h3>Distancia a la Tierra</h3>
                <span>Kilómetros</span>
              </div>

              {registros.length > 0 ? (
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={registros}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="hora"
                        minTickGap={30}
                        tick={{ fontSize: 10 }}
                      />

                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={65}
                      />

                      <Tooltip />

                      <Line
                        type="monotone"
                        dataKey="distanciaTierra"
                        name="Distancia"
                        stroke="#65a9cf"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay datos para representar.
                </p>
              )}
            </section>

            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Clock3 size={15} />
                <h3>Retardo de propagación</h3>
              </div>

              <div className={styles.metricRow}>
                <span>Solo ida</span>

                <strong>
                  {actual
                    ? `${formatoNumero(actual.retardoSeg, 3)} s`
                    : "—"}
                </strong>
              </div>

              <div className={styles.metricRow}>
                <span>Ida y vuelta</span>

                <strong>
                  {actual
                    ? `${formatoNumero(
                        actual.retardoIdaVueltaSeg,
                        3,
                      )} s`
                    : "—"}
                </strong>
              </div>

              <p className={styles.description}>
                Se calcula dividiendo la distancia por la velocidad
                de la luz. Es un retardo físico ideal; no representa
                la latencia real de una red de comunicaciones.
              </p>
            </section>
          </>
        )}

        {/* ========================================== */}
        {/* TERRENO */}
        {/* ========================================== */}

        {tab === "terrain" && (
          <>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeading}>
                <Mountain size={15} />
                <h3>Características del terreno</h3>
              </div>

              {cargandoTerreno && (
                <p className={styles.status}>
                  Cargando modelo de elevación...
                </p>
              )}

              {errorTerreno && (
                <p className={styles.error}>
                  {errorTerreno}
                </p>
              )}

              {!cargandoTerreno && !analisisTerreno && (
                <p className={styles.empty}>
                  No hay información topográfica disponible.
                </p>
              )}

              {analisisTerreno && (
                <>
                  <div className={styles.metricsGrid}>
                    <article className={styles.metricCard}>
                      <span>Elevación central</span>

                      <strong>
                        {formatoNumero(terreno?.centro_m, 0)} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Elevación mínima</span>

                      <strong>
                        {formatoNumero(
                          analisisTerreno.minimo,
                          0,
                        )} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Elevación máxima</span>

                      <strong>
                        {formatoNumero(
                          analisisTerreno.maximo,
                          0,
                        )} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Elevación promedio</span>

                      <strong>
                        {formatoNumero(
                          analisisTerreno.promedio,
                          0,
                        )} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Desnivel regional</span>

                      <strong>
                        {formatoNumero(
                          analisisTerreno.rango,
                          0,
                        )} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Desviación del relieve</span>

                      <strong>
                        {formatoNumero(
                          analisisTerreno.desviacion,
                          1,
                        )} m
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Pendiente media</span>

                      <strong>
                        {analisisTerreno.pendienteMedia === null
                          ? "—"
                          : `${formatoNumero(
                              analisisTerreno.pendienteMedia,
                            )}°`}
                      </strong>
                    </article>

                    <article className={styles.metricCard}>
                      <span>Pendiente máxima</span>

                      <strong>
                        {analisisTerreno.pendienteMaxima === null
                          ? "—"
                          : `${formatoNumero(
                              analisisTerreno.pendienteMaxima,
                            )}°`}
                      </strong>
                    </article>
                  </div>

                  <div className={styles.metricRow}>
                    <span>Separación de las celdas</span>

                    <strong>
                      {formatoNumero(terreno?.celda_m, 1)} m
                    </strong>
                  </div>

                  <div className={styles.metricRow}>
                    <span>Resolución del DEM</span>

                    <strong>
                      {formatoNumero(
                        terreno?.resolucion_dem_m,
                        1,
                      )} m
                    </strong>
                  </div>
                </>
              )}
            </section>

            {analisisTerreno && (
              <>
                <section className={styles.chartSection}>
                  <div className={styles.chartHeading}>
                    <h3>Perfil topográfico</h3>
                    <span>Altitud · metros</span>
                  </div>

                  <div className={styles.chart}>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={analisisTerreno.perfiles}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          type="number"
                          dataKey="distancia_km"
                          tick={{ fontSize: 10 }}
                          label={{
                            value: "Distancia desde el centro (km)",
                            position: "insideBottom",
                            offset: -3,
                            fontSize: 10,
                          }}
                        />

                        <YAxis
                          width={55}
                          tick={{ fontSize: 10 }}
                        />

                        <Tooltip />

                        <Line
                          type="monotone"
                          dataKey="norteSur"
                          name="Corte norte-sur"
                          stroke="#65a9cf"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />

                        <Line
                          type="monotone"
                          dataKey="oesteEste"
                          name="Corte oeste-este"
                          stroke="#d9a441"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className={styles.chartSection}>
                  <div className={styles.chartHeading}>
                    <h3>Perfil del horizonte</h3>
                    <span>Elevación de obstáculos</span>
                  </div>

                  {analisisTerreno.horizonte.length > 0 ? (
                    <div className={styles.chart}>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={analisisTerreno.horizonte}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="azimut"
                            type="number"
                            domain={[0, 360]}
                            ticks={[0, 90, 180, 270, 360]}
                            tick={{ fontSize: 10 }}
                            unit="°"
                          />

                          <YAxis
                            unit="°"
                            tick={{ fontSize: 10 }}
                          />

                          <Tooltip />

                          <Area
                            type="monotone"
                            dataKey="obstaculo"
                            name="Elevación del horizonte"
                            stroke="#8b9fae"
                            fill="#8b9fae"
                            fillOpacity={0.2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className={styles.empty}>
                      El DEM no contiene un perfil de horizonte válido.
                    </p>
                  )}
                </section>
              </>
            )}

            <p className={styles.description}>
              Las pendientes se estiman mediante diferencias centrales
              entre celdas del DEM. El desnivel y las estadísticas
              representan toda la región consultada, no solamente
              el área inmediata del punto de aterrizaje.
            </p>
          </>
        )}

        {/* ========================================== */}
        {/* NOTAS METODOLÓGICAS */}
        {/* ========================================== */}

        <div className={styles.method}>
          <button
            type="button"
            className={styles.detailsButton}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "Ocultar metodología" : "Ver metodología"}

            {expanded ? (
              <ChevronDown size={15} />
            ) : (
              <ArrowRight size={15} />
            )}
          </button>

          {expanded && (
            <div className={styles.description}>
              <p>
                <strong>Iluminación:</strong> se calcula a partir
                de la visibilidad solar. Cuando existe un perfil
                topográfico, la elevación solar se compara con el
                horizonte interpolado para su azimut.
              </p>

              <p>
                <strong>Comunicaciones:</strong> se considera
                disponibilidad visual de la Tierra, distancia y
                propagación ideal de la señal a la velocidad de la luz.
                No se calcula potencia recibida ni calidad de radio.
              </p>

              <p>
                <strong>Terreno:</strong> se utilizan las elevaciones
                del DEM para estimar relieve y pendientes. La resolución
                del modelo limita el tamaño de los obstáculos que pueden
                detectarse.
              </p>

              <p>
                <strong>Porcentajes:</strong> se calculan ponderando
                los intervalos entre registros consecutivos. Son
                estimaciones del periodo muestreado, no mediciones
                continuas.
              </p>

              <p>
                <strong>Limitación:</strong> estos indicadores no
                constituyen una certificación de seguridad para
                aterrizaje ni una evaluación completa de habitabilidad.
              </p>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* COORDENADAS */}
        {/* ========================================== */}

        <button
          type="button"
          className={styles.coordinatesButton}
          onClick={() => onTabChange("summary")}
        >
          <span>Coordenadas del sitio</span>

          <strong>
            {formatoNumero(site.latitud, 4)}°
          </strong>

          <strong>
            {formatoNumero(site.longitud_este, 4)}°
          </strong>

          <ChevronRight size={14} />
        </button>

        <p className={styles.dataFooter}>
          <Activity size={12} />

          {registros.length} REGISTROS ASTRONÓMICOS

          {" · "}

          {etiquetaVisibilidad.toUpperCase()}
        </p>
      </div>
    </aside>
  );
}
