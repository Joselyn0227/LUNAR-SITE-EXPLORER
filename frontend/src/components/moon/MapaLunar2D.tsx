
import { useEffect, useState } from "react";
import L from "leaflet";

import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import type { Zona } from "../../data/ExampleSites";

import {
  normalizarLon,
  redondear,
  type Polo,
  type PuntoLibre,
} from "./coords";

import styles from "./MoonViews.module.css";

type Vista = "general" | Polo;

const URL_TREK_EQ =
  "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

const IMAGENES_POLARES: Record<Polo, string> = {
  norte: "/textures/Polo-norte.png",
  sur: "/textures/Polo-sur.png",
};

const TAMANO_IMAGEN = 2048;
const CENTRO_IMAGEN = TAMANO_IMAGEN / 2;

// Radio aproximado del círculo visible en las imágenes.
const RADIO_IMAGEN = 1020;

// Cobertura asumida: desde el polo hasta los 45 grados de latitud.
const LATITUD_BORDE = 45;

// Orientación de la longitud 0 en cada imagen.
// Debe verificarse con la referencia geográfica del mosaico.
const ROTACION_LONGITUD: Record<Polo, number> = {
  norte: 0,
  sur: 0,
};

const LIMITES_GLOBALES: L.LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

const LIMITES_POLARES: L.LatLngBoundsExpression = [
  [0, 0],
  [TAMANO_IMAGEN, TAMANO_IMAGEN],
];

const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: "general", etiqueta: "Vista general" },
  { id: "norte", etiqueta: "Polo norte" },
  { id: "sur", etiqueta: "Polo sur" },
];

/**
 * Convierte latitud y longitud lunar a coordenadas de la imagen polar.
 * El resultado está expresado como [y, x], que es el formato de Leaflet.
 */
function geograficaAPolar(
  polo: Polo,
  lat: number,
  lon: number
): L.LatLngTuple | null {
  const distanciaAngular =
    polo === "norte" ? 90 - lat : 90 + lat;

  if (distanciaAngular < 0 || distanciaAngular > 45) {
    return null;
  }

  const angulo = (distanciaAngular * Math.PI) / 180;
  const borde = (LATITUD_BORDE * Math.PI) / 180;

  const radio =
    RADIO_IMAGEN *
    (Math.tan(angulo / 2) / Math.tan(borde / 2));

  const longitud =
    ((normalizarLon(lon) + ROTACION_LONGITUD[polo]) *
      Math.PI) /
    180;

  const x = CENTRO_IMAGEN + radio * Math.sin(longitud);
  const y = CENTRO_IMAGEN - radio * Math.cos(longitud);

  return [y, x];
}

/**
 * Convierte una posición de la imagen polar a latitud y longitud.
 */
function polarAGeografica(
  polo: Polo,
  y: number,
  x: number
): PuntoLibre | null {
  const dx = x - CENTRO_IMAGEN;
  const dy = CENTRO_IMAGEN - y;

  const radio = Math.sqrt(dx * dx + dy * dy);

  if (radio > RADIO_IMAGEN) {
    return null;
  }

  const borde = (LATITUD_BORDE * Math.PI) / 180;

  const distanciaAngular =
    2 * Math.atan(
      (radio / RADIO_IMAGEN) * Math.tan(borde / 2)
    );

  const distanciaGrados =
    (distanciaAngular * 180) / Math.PI;

  const lat =
    polo === "norte"
      ? 90 - distanciaGrados
      : -90 + distanciaGrados;

  let lon =
    (Math.atan2(dx, dy) * 180) / Math.PI -
    ROTACION_LONGITUD[polo];

  lon = normalizarLon(lon);

  // La longitud no está definida exactamente en el polo.
  if (radio < 0.001) {
    lon = 0;
  }

  return {
    lat: redondear(lat),
    lon: redondear(lon),
  };
}

/**
 * Convierte coordenadas geográficas al formato que utiliza cada mapa.
 */
function aLatLng(
  vista: Vista,
  lat: number,
  lon: number
): L.LatLngTuple | null {
  if (vista === "general") {
    return [
      lat,
      Math.abs(lat) >= 89.999999 ? 0 : normalizarLon(lon),
    ];
  }

  return geograficaAPolar(vista, lat, lon);
}

/**
 * Ajusta la imagen polar al espacio disponible.
 */
function AjustarImagen() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(L.latLngBounds(LIMITES_POLARES), {
      padding: [10, 10],
    });
  }, [map]);

  return null;
}

function CapturaClic({
  vista,
  onSelectPoint,
}: {
  vista: Vista;
  onSelectPoint: (p: PuntoLibre) => void;
}) {
  useMapEvents({
    click(e) {
      let punto: PuntoLibre | null = null;

      if (vista === "general") {
        const lat = Math.max(-90, Math.min(90, e.latlng.lat));

        punto = {
          lat: redondear(lat),
          lon:
            Math.abs(lat) >= 89.999999
              ? 0
              : redondear(normalizarLon(e.latlng.lng)),
        };
      } else {
        punto = polarAGeografica(
          vista,
          e.latlng.lat,
          e.latlng.lng
        );
      }

      if (punto) {
        onSelectPoint(punto);
      }
    },
  });

  return null;
}

function MantenerVisible({
  pos,
}: {
  pos: L.LatLngTuple | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!pos) return;

    map.panInside(pos, {
      padding: [60, 60],
    });
  }, [map, pos]);

  return null;
}

interface Props {
  zonas: Zona[];
  selectedId: number | null;
  puntoLibre: PuntoLibre | null;
  onSelectSite: (id: number) => void;
  onSelectPoint: (p: PuntoLibre) => void;
}

function Capas({
  vista,
  zonas,
  selectedId,
  puntoLibre,
  onSelectSite,
  onSelectPoint,
}: Props & { vista: Vista }) {
  const zonaSel = zonas.find((z) => z.id === selectedId);

  const posSel = puntoLibre
    ? aLatLng(vista, puntoLibre.lat, puntoLibre.lon)
    : zonaSel
      ? aLatLng(
          vista,
          zonaSel.latitud,
          normalizarLon(zonaSel.longitud_este)
        )
      : null;

  return (
    <>
      <CapturaClic
        vista={vista}
        onSelectPoint={onSelectPoint}
      />

      <MantenerVisible pos={posSel} />

      {zonas.map((z) => {
        const pos = aLatLng(
          vista,
          z.latitud,
          normalizarLon(z.longitud_este)
        );

        if (!pos) return null;

        return (
          <CircleMarker
            key={z.id}
            center={pos}
            radius={5}
            bubblingMouseEvents={false}
            pathOptions={{
              color: "#4aa8e8",
              weight: 1,
              fillOpacity: 0.7,
            }}
            eventHandlers={{
              click: () => onSelectSite(z.id),
            }}
          >
            <Tooltip>{z.nombre}</Tooltip>
          </CircleMarker>
        );
      })}

      {posSel && (
        <CircleMarker
          center={posSel}
          radius={10}
          interactive={false}
          pathOptions={{
            color: "#ffd166",
            weight: 2,
            fillOpacity: 0.25,
          }}
        />
      )}
    </>
  );
}

export default function MapaLunar2D(props: Props) {
  const [vista, setVista] = useState<Vista>("general");

  const esGeneral = vista === "general";

  const centro: L.LatLngTuple = esGeneral
    ? [0, 0]
    : [CENTRO_IMAGEN, CENTRO_IMAGEN];

  return (
    <>
      <div
        className={styles.vistas}
        role="group"
        aria-label="Vista del mapa"
      >
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`${styles.boton} ${
              vista === v.id ? styles.activo : ""
            }`}
            aria-pressed={vista === v.id}
            onClick={() => setVista(v.id)}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <MapContainer
        key={vista}
        className={styles.mapa}
        crs={esGeneral ? L.CRS.EPSG4326 : L.CRS.Simple}
        center={centro}
        zoom={esGeneral ? 1 : -2}
        minZoom={esGeneral ? 0 : -4}
        maxZoom={esGeneral ? 6 : 3}
        maxBounds={
          esGeneral ? LIMITES_GLOBALES : LIMITES_POLARES
        }
        maxBoundsViscosity={1}
        zoomSnap={0.25}
      >
        {esGeneral ? (
          <TileLayer
            url={URL_TREK_EQ}
            noWrap
            bounds={LIMITES_GLOBALES}
            attribution="NASA/JPL Moon Trek · LRO WAC"
          />
        ) : (
          <>
            <ImageOverlay
              url={IMAGENES_POLARES[vista]}
              bounds={LIMITES_POLARES}
              interactive={false}
            />
            <AjustarImagen />
          </>
        )}

        <Capas vista={vista} {...props} />
      </MapContainer>
    </>
  );
}
