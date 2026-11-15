import { useState } from "react";
import MapaLunar2D from "./MapaLunar2D";
import MoonExplorer3D from "./MoonExplorer3D";
import { SITIOS } from "./sitios";
import type { Seleccion } from "./tipos";
import styles from "./MoonExplorer.module.css";

interface Props {
  onSeleccion?: (p: Seleccion) => void;   // punto confirmado: se lo pasas a tu API
}

export default function MoonExplorer({ onSeleccion }: Props) {
  const [modo, setModo] = useState<"2d" | "3d">("2d");
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);

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
        <MapaLunar2D sitios={SITIOS} seleccion={seleccion} onElegir={setSeleccion} />
      ) : (
        <MoonExplorer3D sitios={SITIOS} seleccion={seleccion} onElegir={setSeleccion} />
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