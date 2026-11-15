import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Zona } from "../../data/ExampleSites";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import MoonBody from "./MoonBody";
import { MOON_RADIUS } from "./moonConfig";
import { normalizarLon, type PuntoLibre } from "./coords";
import styles from "./MoonViews.module.css";

const RAD = Math.PI / 180;
const LUZ: [number, number, number] = [-4, 3, 3];

// Si los marcadores salen girados respecto a la textura, ajusta este valor
const LON_TEXTURA_OFFSET_DEG = 0;

// Distancias de la cámara al centro de la esfera, en radios lunares
const DIST_VISTA = 3.2;
const DIST_SITIO = 1.45;
const DIST_MIN = 1.08;
const DIST_MAX = 6;

// Orden del botón de zoom: id cambia en cada pulsación para que React la detecte
export interface ZoomCmd {
  id: number;
  factor: number;
  reset?: boolean;
}

// Convención de la esfera de Three.js: el centro de una textura equirrectangular
// (longitud 0°) cae sobre +X, el norte es +Y y el este va hacia -Z.
function latLonAVector3(
  lat: number,
  lon: number,
  radio: number,
): THREE.Vector3 {
  const phi = lat * RAD;
  const lam = (lon + LON_TEXTURA_OFFSET_DEG) * RAD;
  return new THREE.Vector3(
    radio * Math.cos(phi) * Math.cos(lam),
    radio * Math.sin(phi),
    -radio * Math.cos(phi) * Math.sin(lam),
  );
}

const aTupla = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
const POS_INICIAL = aTupla(latLonAVector3(-50, 30, MOON_RADIUS * DIST_VISTA));

interface MarcadorProps {
  nombre: string;
  lat: number;
  lon: number;
  seleccionado: boolean;
  onElegir: () => void;
}

function Marcador({ nombre, lat, lon, seleccionado, onElegir }: MarcadorProps) {
  const [hover, setHover] = useState(false);
  const posicion = useMemo(
    () => aTupla(latLonAVector3(lat, lon, MOON_RADIUS * 1.004)),
    [lat, lon],
  );

  const alEntrar = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const alSalir = () => {
    setHover(false);
    document.body.style.cursor = "auto";
  };

  const activo = seleccionado || hover;
  return (
    <mesh
      position={posicion}
      onClick={(e) => {
        e.stopPropagation();
        onElegir();
      }}
      onPointerOver={alEntrar}
      onPointerOut={alSalir}
    >
      <sphereGeometry args={[MOON_RADIUS * (activo ? 0.016 : 0.01), 16, 16]} />
      <meshBasicMaterial
        color={seleccionado ? "#ffd166" : hover ? "#ffffff" : "#4aa8e8"}
      />
      {activo && (
        <Html center style={{ pointerEvents: "none" }}>
          <div className={styles.etiqueta}>{nombre}</div>
        </Html>
      )}
    </mesh>
  );
}

// Pin del punto elegido en el mapa 2D (no se puede elegir desde aquí)
function PinLibre({ punto }: { punto: PuntoLibre }) {
  const posicion = useMemo(
    () => aTupla(latLonAVector3(punto.lat, punto.lon, MOON_RADIUS * 1.004)),
    [punto.lat, punto.lon],
  );
  return (
    <mesh position={posicion}>
      <sphereGeometry args={[MOON_RADIUS * 0.016, 16, 16]} />
      <meshBasicMaterial color="#ffd166" />
    </mesh>
  );
}

interface VueloProps {
  objetivo: PuntoLibre | null;
  zoom: ZoomCmd;
}

// Controles de órbita, más el vuelo suave hacia el sitio elegido y los botones de zoom
function Vuelo({ objetivo, zoom }: VueloProps) {
  const camera = useThree((s) => s.camera);
  const controles = useThree((s) => s.controls) as unknown as {
    update: () => void;
  } | null;
  const destino = useRef<THREE.Vector3 | null>(null);

  const lat = objetivo?.lat;
  const lon = objetivo?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    destino.current = latLonAVector3(lat, lon, MOON_RADIUS * DIST_SITIO);
  }, [lat, lon]);

  useEffect(() => {
    if (zoom.id === 0) return; // aún no se ha pulsado ningún botón de zoom
    const largo = zoom.reset
      ? MOON_RADIUS * DIST_VISTA
      : camera.position.length() / zoom.factor;
    destino.current = camera.position
      .clone()
      .setLength(
        THREE.MathUtils.clamp(
          largo,
          MOON_RADIUS * DIST_MIN,
          MOON_RADIUS * DIST_MAX,
        ),
      );
  }, [zoom, camera]);

  useFrame((_, delta) => {
    const d = destino.current;
    if (!d) return;
    camera.position.lerp(d, 1 - Math.exp(-5 * delta));
    controles?.update();
    if (camera.position.distanceTo(d) < MOON_RADIUS * 0.002)
      destino.current = null;
  });

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      minDistance={MOON_RADIUS * DIST_MIN}
      maxDistance={MOON_RADIUS * DIST_MAX}
      onStart={() => {
        destino.current = null; // si el usuario toma el control, se cancela el vuelo
      }}
    />
  );
}

interface Props {
  zonas: Zona[];
  selectedId: number | null;
  puntoLibre: PuntoLibre | null;
  onSelectSite: (id: number) => void;
  zoom: ZoomCmd;
}

export default function Moon3D({
  zonas,
  selectedId,
  puntoLibre,
  onSelectSite,
  zoom,
}: Props) {
  const reduced = usePrefersReducedMotion();

  const sitio = zonas.find((z) => z.id === selectedId);
  const objetivo: PuntoLibre | null =
    puntoLibre ??
    (sitio
      ? { lat: sitio.latitud, lon: normalizarLon(sitio.longitud_este) }
      : null);

  return (
    <Canvas
      camera={{ position: POS_INICIAL, fov: 35, near: 0.01, far: 300 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={LUZ} intensity={2.4} color="#f4f8ff" />
      <Suspense fallback={null}>
        <Stars
          radius={80}
          depth={50}
          count={2500}
          factor={3.5}
          saturation={0}
          fade
          speed={!reduced ? 0.6 : 0}
        />
        <MoonBody
          lightDirection={LUZ}
          spin={0}
          tilt={[0, 0, 0]}
          bloquearPuntero
        >
          {zonas.map((z) => (
            <Marcador
              key={z.id}
              nombre={z.nombre}
              lat={z.latitud}
              lon={normalizarLon(z.longitud_este)}
              seleccionado={z.id === selectedId}
              onElegir={() => onSelectSite(z.id)}
            />
          ))}
          {puntoLibre && <PinLibre punto={puntoLibre} />}
        </MoonBody>
      </Suspense>
      <Vuelo objetivo={objetivo} zoom={zoom} />
    </Canvas>
  );
}
