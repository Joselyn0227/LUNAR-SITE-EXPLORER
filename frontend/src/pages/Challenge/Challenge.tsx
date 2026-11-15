import { ArrowRight, Mountain, Sun, Wifi } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatCard } from "../../components/ui/StatCard";
import MoonScene from "../../components/moon/MoonScene";
import styles from "./Challenge.module.css";

const factors = [
  {
    icon: <Mountain size={22} />,
    title: "Topografía lunar",
    text: "La elevación, las pendientes y los cráteres influyen en las condiciones del descenso y la exploración.",
  },
  {
    icon: <Sun size={22} />,
    title: "Iluminación solar",
    text: "La luz llega con ángulos bajos y el relieve proyecta sombras que condicionan la energía disponible.",
  },
  {
    icon: <Wifi size={22} />,
    title: "Comunicación con la Tierra",
    text: "La posición aparente de la Tierra y el horizonte local pueden afectar la comunicación directa.",
  },
];

const importance = [
  { value: "3", text: "factores relacionados" },
  { value: "1", text: "región de interés: polo sur" },
  { value: "1", text: "herramienta educativa" },
];

export default function Challenge() {
  return (
    <section className={styles.page}>
      <div className={`container ${styles.grid}`}>
        <div className={`${styles.copy} anim-fade-up`}>
          <SectionLabel>El reto</SectionLabel>
          <h1 className={styles.title}>Elegir un sitio lunar exige analizar más de una variable</h1>

          <div className={styles.statement}>
            <SectionLabel>Planteamiento del problema</SectionLabel>
            <p>
              Seleccionar posibles sitios de aterrizaje en el polo sur lunar requiere evaluar
              simultáneamente la topografía, la iluminación solar y la comunicación con la Tierra.
              Las condiciones cambian según la ubicación y el tiempo, por lo que ningún factor
              aislado describe por completo el entorno.
            </p>
          </div>

          <SectionLabel>Bases principales</SectionLabel>
          <ul className={styles.factors}>
            {factors.map((f) => (
              <li key={f.title} className={styles.factor}>
                <span className={styles.factorIcon}>{f.icon}</span>
                <div>
                  <h2 className={styles.factorTitle}>{f.title}</h2>
                  <p className={styles.factorText}>{f.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            Los modelos de elevación de LOLA ayudan a estudiar el relieve lunar, mientras que JPL
            Horizons proporciona posiciones astronómicas del Sol y la Tierra. Integrar estas
            perspectivas permite explorar escenarios de manera preliminar; no sustituye las
            validaciones necesarias para una misión real.
          </p>

          <Button to="/solucion" variant="outline" icon={<ArrowRight size={16} />}>
            Ver la solución
          </Button>
        </div>

        <div className={styles.moon}>
          <MoonScene layout="challenge" />
          <span className={styles.reticle} aria-hidden="true" />
        </div>

        <aside className={styles.side}>
          <div className={styles.coords}>
            <StatCard label="Zona de interés" value="Polo sur lunar" />
            <StatCard label="Factores" value="Relieve · Sol · Tierra" />
          </div>

          <GlassCard className={styles.importance}>
            <h2 className={styles.importanceTitle}>Importancia del reto</h2>
            <ul className={styles.importanceList}>
              {importance.map((item) => (
                <li key={item.value}>
                  <span className={styles.num}>{item.value}</span>
                  <span className={styles.numText}>{item.text}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </aside>
      </div>
    </section>
  );
}