import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import * as THREE from "three";

import styles from "./SurfaceView3D.module.css";

// ======================================================
// Tipos de la API
// ======================================================

export interface AstroData {
  azimut_deg: number;
  elevacion_deg: number;
  visible: boolean;
  diametro_angular_arcsec: number;
  distancia_km: number;
}

export interface PuntoCielo {
  fecha_utc: string;
  fecha_local: string;
  tierra: AstroData;
  sol: AstroData;
}

export interface HorizonteData {
  azimut_deg: number;
  elevacion_deg: number;
}

export interface TerrenoLunar {
  lat: number;
  lon: number;
  radio_km: number;
  n: number;
  celda_m: number;
  resolucion_dem_m: number;
  centro_m: number;
  elevaciones_m: number[];
  horizonte: HorizonteData[];
}

// ======================================================
// Constantes
// ======================================================

// Radio de referencia lunar utilizado por el DEM.
const RADIO_LUNA_M = 1_737_400;

// Escala visual: 1 unidad de Three.js representa 100 metros.
const ESCALA = 0.01;

// Altura aproximada de la cámara sobre la superficie.
const ALTURA_OJO = 1.7 * ESCALA;

// Distancia visual de los cuerpos celestes.
// No representa su distancia física real; se utiliza para
// conservar su tamaño angular en la perspectiva.
const DISTANCIA_CIELO = 2500;

const RAD = Math.PI / 180;
const ARCSEC_A_RAD = Math.PI / (180 * 3600);

// ======================================================
// Conversión de coordenadas astronómicas
// ======================================================

function direccionDesdeHorizonte(
  azimut: number,
  elevacion: number,
): THREE.Vector3 {
  const az = azimut * RAD;
  const el = elevacion * RAD;

  const horizontal = Math.cos(el);

  return new THREE.Vector3(
    Math.sin(az) * horizontal,
    Math.sin(el),
    Math.cos(az) * horizontal,
  );
}

function normalizarAzimut(azimut: number): number {
  return ((azimut % 360) + 360) % 360;
}

// ======================================================
// Interpolación del horizonte del DEM
// ======================================================

function obtenerHorizonte(horizonte: HorizonteData[], azimut: number): number {
  if (horizonte.length === 0) return 0;

  const az = normalizarAzimut(azimut);

  let indiceSuperior = horizonte.findIndex((punto) => punto.azimut_deg >= az);

  if (indiceSuperior === -1) {
    indiceSuperior = 0;
  }

  const indiceInferior =
    (indiceSuperior - 1 + horizonte.length) % horizonte.length;

  const inferior = horizonte[indiceInferior];
  const superior = horizonte[indiceSuperior];

  const a0 = normalizarAzimut(inferior.azimut_deg);

  let a1 = normalizarAzimut(superior.azimut_deg);

  let objetivo = az;

  // Resolver la interpolación cuando se cruza el azimut 0°.
  if (a1 <= a0) {
    a1 += 360;
  }

  if (objetivo < a0) {
    objetivo += 360;
  }

  const intervalo = a1 - a0;

  if (intervalo <= 0) {
    return inferior.elevacion_deg;
  }

  const proporcion = THREE.MathUtils.clamp((objetivo - a0) / intervalo, 0, 1);

  return THREE.MathUtils.lerp(
    inferior.elevacion_deg,
    superior.elevacion_deg,
    proporcion,
  );
}

function evaluarVisibilidad(astro: AstroData, horizonte: HorizonteData[]) {
  const alturaTerreno = obtenerHorizonte(horizonte, astro.azimut_deg);

  if (!astro.visible) {
    return {
      visible: false,
      alturaTerreno,
      estado: "Bajo el horizonte",
    };
  }

  const visible = astro.elevacion_deg > alturaTerreno;

  return {
    visible,
    alturaTerreno,
    estado: visible ? "Visible" : "Oculto por el relieve",
  };
}

// ======================================================
// Construcción de la geometría del terreno
// ======================================================

function crearGeometriaTerreno(terreno: TerrenoLunar): THREE.BufferGeometry {
  const { n, elevaciones_m, celda_m, centro_m } = terreno;

  if (
    !Number.isInteger(n) ||
    n < 3 ||
    elevaciones_m.length !== n * n ||
    !Number.isFinite(celda_m) ||
    celda_m <= 0
  ) {
    throw new Error("La malla de terreno recibida no es válida.");
  }

  const cantidad = n * n;

  const posiciones = new Float32Array(cantidad * 3);
  const colores = new Float32Array(cantidad * 3);

  const centro = (n - 1) / 2;

  let minimo = Infinity;
  let maximo = -Infinity;

  // Calcular el relieve corregido por la curvatura lunar.
  const alturas = new Float32Array(cantidad);

  for (let fila = 0; fila < n; fila++) {
    for (let columna = 0; columna < n; columna++) {
      const indice = fila * n + columna;

      const xMetros = (columna - centro) * celda_m;
      const zMetros = (centro - fila) * celda_m;

      const distanciaCuadrada = xMetros * xMetros + zMetros * zMetros;

      const elevacion = elevaciones_m[indice];

      // Altura relativa al observador, descontando la caída
      // de la superficie esférica respecto al plano tangente.
      const altura =
        elevacion - centro_m - distanciaCuadrada / (2 * RADIO_LUNA_M);

      alturas[indice] = altura;

      minimo = Math.min(minimo, altura);
      maximo = Math.max(maximo, altura);

      const base = indice * 3;

      posiciones[base] = xMetros * ESCALA;
      posiciones[base + 1] = altura * ESCALA;
      posiciones[base + 2] = zMetros * ESCALA;
    }
  }

  // Colores en escala de grises según la altura del relieve.
  const rango = Math.max(maximo - minimo, 0.001);

  for (let i = 0; i < cantidad; i++) {
    const relativo = THREE.MathUtils.clamp((alturas[i] - minimo) / rango, 0, 1);

    const brillo = 0.28 + relativo * 0.36;
    const base = i * 3;

    colores[base] = brillo * 0.96;
    colores[base + 1] = brillo;
    colores[base + 2] = brillo * 1.04;
  }

  // Índices de los triángulos.
  // La fila 0 corresponde al norte y las columnas
  // avanzan desde el oeste hacia el este.
  const indices: number[] = [];

  for (let fila = 0; fila < n - 1; fila++) {
    for (let columna = 0; columna < n - 1; columna++) {
      const superiorIzquierdo = fila * n + columna;
      const superiorDerecho = superiorIzquierdo + 1;
      const inferiorIzquierdo = superiorIzquierdo + n;
      const inferiorDerecho = inferiorIzquierdo + 1;

      indices.push(
        superiorIzquierdo,
        superiorDerecho,
        inferiorIzquierdo,

        superiorDerecho,
        inferiorDerecho,
        inferiorIzquierdo,
      );
    }
  }

  const geometria = new THREE.BufferGeometry();

  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));

  geometria.setAttribute("color", new THREE.BufferAttribute(colores, 3));

  geometria.setIndex(indices);

  geometria.computeVertexNormals();
  geometria.computeBoundingSphere();

  return geometria;
}

// ======================================================
// Textura procedural sencilla de la Tierra
// ======================================================

function crearTexturaTierra(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const fondo = ctx.createLinearGradient(0, 0, 0, 256);

  fondo.addColorStop(0, "#17476f");
  fondo.addColorStop(0.5, "#246c9b");
  fondo.addColorStop(1, "#123a60");

  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, 512, 256);

  // Masas continentales estilizadas.
  ctx.fillStyle = "#628f64";

  ctx.beginPath();
  ctx.moveTo(55, 50);
  ctx.lineTo(105, 36);
  ctx.lineTo(150, 60);
  ctx.lineTo(160, 105);
  ctx.lineTo(133, 132);
  ctx.lineTo(125, 183);
  ctx.lineTo(100, 205);
  ctx.lineTo(75, 150);
  ctx.lineTo(48, 120);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(210, 45);
  ctx.lineTo(265, 35);
  ctx.lineTo(300, 60);
  ctx.lineTo(325, 92);
  ctx.lineTo(310, 125);
  ctx.lineTo(278, 117);
  ctx.lineTo(260, 150);
  ctx.lineTo(230, 126);
  ctx.lineTo(190, 100);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(320, 150);
  ctx.lineTo(365, 135);
  ctx.lineTo(410, 150);
  ctx.lineTo(438, 190);
  ctx.lineTo(405, 218);
  ctx.lineTo(360, 204);
  ctx.fill();

  // Nubes.
  ctx.strokeStyle = "rgba(230, 243, 250, 0.45)";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(20, 90);
  ctx.bezierCurveTo(90, 65, 120, 110, 185, 78);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(275, 28);
  ctx.bezierCurveTo(335, 10, 390, 40, 470, 22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(300, 185);
  ctx.bezierCurveTo(365, 155, 420, 185, 500, 166);
  ctx.stroke();

  const textura = new THREE.CanvasTexture(canvas);

  textura.colorSpace = THREE.SRGBColorSpace;

  return textura;
}

// ======================================================
// Cámara fija en la posición del observador
// ======================================================

interface CamaraProps {
  heading: number;
  pitch: number;
}

function CamaraSuperficie({ heading, pitch }: CamaraProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const direccion = direccionDesdeHorizonte(heading, pitch);

    camera.position.set(0, ALTURA_OJO, 0);

    camera.up.set(0, 1, 0);

    camera.lookAt(
      direccion.x * 100 + camera.position.x,
      direccion.y * 100 + camera.position.y,
      direccion.z * 100 + camera.position.z,
    );

    camera.updateProjectionMatrix();
  }, [camera, heading, pitch]);

  return null;
}

// ======================================================
// Representación de un cuerpo celeste
// ======================================================

interface CuerpoCelesteProps {
  tipo: "sol" | "tierra";
  astro: AstroData;
  horizonte: HorizonteData[];
  texturaTierra: THREE.CanvasTexture | null;
}

function CuerpoCeleste({
  tipo,
  astro,
  horizonte,
  texturaTierra,
}: CuerpoCelesteProps) {
  const posicion = useMemo(() => {
    return direccionDesdeHorizonte(
      astro.azimut_deg,
      astro.elevacion_deg,
    ).multiplyScalar(DISTANCIA_CIELO);
  }, [astro.azimut_deg, astro.elevacion_deg]);

  const visibilidad = useMemo(
    () => evaluarVisibilidad(astro, horizonte),
    [astro, horizonte],
  );

  // Usar el diámetro angular informado por Horizons.
  // Si no está disponible, aplicar un valor aproximado.
  const diametroArcsec =
    astro.diametro_angular_arcsec || (tipo === "sol" ? 1900 : 6900);

  const radio = Math.max(
    0.5,
    DISTANCIA_CIELO * Math.tan((diametroArcsec * ARCSEC_A_RAD) / 2),
  );

  if (!visibilidad.visible) {
    return null;
  }

  return (
    <group position={[posicion.x, posicion.y, posicion.z]}>
      {tipo === "sol" ? (
        <>
          <mesh>
            <sphereGeometry args={[radio, 32, 24]} />
            <meshBasicMaterial color="#ffd477" toneMapped={false} />
          </mesh>

          <mesh scale={1.8}>
            <sphereGeometry args={[radio, 24, 16]} />
            <meshBasicMaterial
              color="#ffb347"
              transparent
              opacity={0.13}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh>
            <sphereGeometry args={[radio, 48, 32]} />
            <meshStandardMaterial
              map={texturaTierra ?? undefined}
              color="#ffffff"
              roughness={0.9}
            />
          </mesh>

          <mesh scale={1.12}>
            <sphereGeometry args={[radio, 32, 24]} />
            <meshBasicMaterial
              color="#79bde9"
              transparent
              opacity={0.12}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      <Html center distanceFactor={1200} style={{ pointerEvents: "none" }}>
        <span className={styles.objectLabel}>
          {tipo === "sol" ? "SOL" : "TIERRA"}
        </span>
      </Html>
    </group>
  );
}

// ======================================================
// Escena 3D
// ======================================================

interface EscenaProps {
  terreno: TerrenoLunar | null;
  punto: PuntoCielo | null;
  heading: number;
  pitch: number;
  wireframe: boolean;
}

function EscenaSuperficie({
  terreno,
  punto,
  heading,
  pitch,
  wireframe,
}: EscenaProps) {
  const geometria = useMemo(() => {
    if (!terreno) return null;

    return crearGeometriaTerreno(terreno);
  }, [terreno]);

  const texturaTierra = useMemo(() => crearTexturaTierra(), []);

  useEffect(() => {
    return () => {
      geometria?.dispose();
    };
  }, [geometria]);

  useEffect(() => {
    return () => {
      texturaTierra?.dispose();
    };
  }, [texturaTierra]);

  const direccionSol = useMemo(() => {
    if (!punto) return new THREE.Vector3(0, 1, 0);

    return direccionDesdeHorizonte(
      punto.sol.azimut_deg,
      punto.sol.elevacion_deg,
    );
  }, [punto]);

  const luzPosicion: [number, number, number] = [
    direccionSol.x * 100,
    direccionSol.y * 100,
    direccionSol.z * 100,
  ];

  const solSobreHorizonte = punto?.sol.visible ?? false;

  return (
    <>
      <color attach="background" args={["#03060c"]} />

      <Stars
        radius={6500}
        depth={2000}
        count={1400}
        factor={3}
        saturation={0}
        fade
        speed={0}
      />

      <ambientLight intensity={solSobreHorizonte ? 0.36 : 0.18} />

      {punto && (
        <directionalLight
          position={luzPosicion}
          intensity={solSobreHorizonte ? 1.7 : 0.08}
          color="#fff1d1"
        />
      )}

      <CamaraSuperficie heading={heading} pitch={pitch} />

      {geometria && (
        <>
          <mesh geometry={geometria} receiveShadow>
            <meshStandardMaterial
              vertexColors
              roughness={1}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>

          {wireframe && (
            <mesh geometry={geometria}>
              <meshBasicMaterial
                color="#a8c4d5"
                wireframe
                transparent
                opacity={0.2}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
              />
            </mesh>
          )}
        </>
      )}

      {terreno && punto && (
        <>
          <CuerpoCeleste
            tipo="sol"
            astro={punto.sol}
            horizonte={terreno.horizonte}
            texturaTierra={texturaTierra}
          />

          <CuerpoCeleste
            tipo="tierra"
            astro={punto.tierra}
            horizonte={terreno.horizonte}
            texturaTierra={texturaTierra}
          />
        </>
      )}
    </>
  );
}

// ======================================================
// Vista principal
// ======================================================

interface Props {
  terreno: TerrenoLunar | null;
  punto: PuntoCielo | null;
  cargando: boolean;
  error: string | null;
  ground: boolean;
}

export default function SurfaceView3D({
  terreno,
  punto,
  cargando,
  error,
  ground,
}: Props) {
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(3);

  const estadoSol =
    terreno && punto ? evaluarVisibilidad(punto.sol, terreno.horizonte) : null;

  const estadoTierra =
    terreno && punto
      ? evaluarVisibilidad(punto.tierra, terreno.horizonte)
      : null;

  const mirarHacia = (azimut: number) => {
    setHeading(normalizarAzimut(azimut));
  };

  return (
    <div
      className={styles.root}
      aria-label="Simulación desde la superficie lunar"
    >
      <Canvas
        className={styles.canvas}
        camera={{
          position: [0, ALTURA_OJO, 0],
          fov: 70,
          near: 0.001,
          far: 10_000,
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <EscenaSuperficie
          terreno={terreno}
          punto={punto}
          heading={heading}
          pitch={pitch}
          wireframe={ground}
        />
      </Canvas>

      <div className={styles.readouts}>
        <div className={styles.readout}>
          <span className={styles.readoutTitle}>SOL</span>

          <strong
            className={estadoSol?.visible ? styles.visible : styles.hidden}
          >
            {estadoSol?.estado ?? "Sin datos"}
          </strong>

          {punto && (
            <small>
              AZ {punto.sol.azimut_deg.toFixed(1)}°{" · "}
              EL {punto.sol.elevacion_deg.toFixed(1)}°
            </small>
          )}
        </div>

        <div className={styles.readout}>
          <span className={styles.readoutTitle}>TIERRA</span>

          <strong
            className={estadoTierra?.visible ? styles.visible : styles.hidden}
          >
            {estadoTierra?.estado ?? "Sin datos"}
          </strong>

          {punto && (
            <small>
              AZ {punto.tierra.azimut_deg.toFixed(1)}°{" · "}
              EL {punto.tierra.elevacion_deg.toFixed(1)}°
            </small>
          )}
        </div>
      </div>

      <div className={styles.cameraControls}>
        <div className={styles.directionButtons}>
          <button type="button" onClick={() => mirarHacia(0)}>
            Norte
          </button>

          <button
            type="button"
            disabled={!punto}
            onClick={() => punto && mirarHacia(punto.sol.azimut_deg)}
          >
            Sol
          </button>

          <button
            type="button"
            disabled={!punto}
            onClick={() => punto && mirarHacia(punto.tierra.azimut_deg)}
          >
            Tierra
          </button>
        </div>

        <label>
          <span>Rumbo: {heading.toFixed(0)}°</span>

          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={heading}
            onChange={(event) => setHeading(Number(event.target.value))}
          />
        </label>

        <label>
          <span>Inclinación: {pitch.toFixed(0)}°</span>

          <input
            type="range"
            min={-10}
            max={60}
            step={1}
            value={pitch}
            onChange={(event) => setPitch(Number(event.target.value))}
          />
        </label>
      </div>

      {cargando && (
        <div className={styles.message} role="status">
          Cargando modelo de elevación lunar...
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {!cargando && !error && !terreno && (
        <div className={styles.message}>
          Selecciona una ubicación para cargar el terreno.
        </div>
      )}

      {terreno && (
        <div className={styles.terrainInfo}>
          <span>RADIO: {terreno.radio_km.toFixed(1)} KM</span>

          <span>
            MALLA: {terreno.n} × {terreno.n}
          </span>

          <span>RESOLUCIÓN DEM: {terreno?.resolucion_dem_m?.toFixed(1)} M</span>
        </div>
      )}
    </div>
  );
}
