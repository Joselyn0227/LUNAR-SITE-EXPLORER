import { useState } from "react";
import MapaLunar2D from "./MapaLunar2D";
import MoonExplorer3D, { type ZoomCmd } from "./MoonExplorer3D";
import { exampleSites } from "../../data/ExampleSites";
import { normalizarLon, type PuntoLibre } from "./coords";
import type { Seleccion } from "./tipos";
import styles from "./MoonExplorer.module.css";

const ZOOM_SIN_ACCION: ZoomCmd = { id: 0, factor: 1 };

interface Props {
  onSeleccion?: (p: Seleccion) => void;
}

export default function MoonExplorer({ onSeleccion }: Props) {
  const [modo, setModo] = useState<"2d" | "3d">("2d");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [puntoLibre, setPuntoLibre] = useState<PuntoLibre | null>(null);
  const zonaSeleccionada = exampleSites.zonas.find((zona) => zona.id === selectedId);
  const seleccion: Seleccion | null = puntoLibre
    ? { lat: puntoLibre.lat, lon: puntoLibre.lon }
    : zonaSeleccionada
      ? {
          lat: zonaSeleccionada.latitud,
          lon: normalizarLon(zonaSeleccionada.longitud_este),
          nombre: zonaSeleccionada.nombre,
          sitioId: zonaSeleccionada.id,
        }
      : null;

  const seleccionarSitio = (id: number) => {
    setSelectedId(id);
    setPuntoLibre(null);
  };

  const seleccionarPunto = (punto: PuntoLibre) => {
    setSelectedId(null);
    setPuntoLibre(punto);
  };

  return (
    <section className={styles.explorador}>
      <div className={styles.barra} role="tablist" aria-label="Tipo de vista">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            className={`${styles.boton} ${modo === m ? styles.activo : ""}`}
            onClick={() => setModo(m)}
          >
            {m === "2d" ? "Mapa 2D" : "Esfera 3D"}
          </button>
        ))}
      </div>

      {modo === "2d" ? (
        <MapaLunar2D
          zonas={exampleSites.zonas}
          selectedId={selectedId}
          puntoLibre={puntoLibre}
          onSelectSite={seleccionarSitio}
          onSelectPoint={seleccionarPunto}
        />
      ) : (
        <MoonExplorer3D
          zonas={exampleSites.zonas}
          selectedId={selectedId}
          puntoLibre={puntoLibre}
          onSelectSite={seleccionarSitio}
          zoom={ZOOM_SIN_ACCION}
        />
      )}

      <div className={styles.barra}>
        <p>
          {seleccion
            ? `${seleccion.nombre ?? "Punto elegido"}: lat ${seleccion.lat}°, lon ${seleccion.lon}°`
            : modo === "2d"
              ? "Haz clic en el mapa para elegir un punto."
              : "Elige un sitio de la lista o un marcador."}
        </p>
        <button
          type="button"
          className={styles.boton}
          disabled={!seleccion}
          onClick={() => seleccion && onSeleccion?.(seleccion)}
        >
          Usar este punto
        </button>
      </div>
    </section>
  );
}