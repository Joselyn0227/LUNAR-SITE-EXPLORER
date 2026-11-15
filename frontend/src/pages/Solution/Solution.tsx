import { useEffect, useState } from "react";
import { ArrowRight, Database, Globe2, MapPinned, Mountain, Sun, Users } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatCard } from "../../components/ui/StatCard";
import MoonScene from "../../components/moon/MoonScene";
import styles from "./Solution.module.css";

const capabilities = [
  {
    icon: <Sun size={20} />,
    title: "Luz solar",
    text: "Considera la posición del Sol para entender la disponibilidad de energía en cada zona.",
  },
  {
    icon: <Globe2 size={20} />,
    title: "Comunicación con la Tierra",
    text: "Tiene en cuenta la visibilidad de la Tierra como un factor para mantener el contacto.",
  },
  {
    icon: <MapPinned size={20} />,
    title: "Exploración de sitios",
    text: "Reúne los factores clave en una experiencia para explorar y comparar posibles lugares de aterrizaje.",
  },
];

type ResearchPdfStatus = "checking" | "ready" | "missing" | "error";

function useResearchPdfStatus(): ResearchPdfStatus {
  const [status, setStatus] = useState<ResearchPdfStatus>("checking");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/docs/investigacion.pdf", { method: "HEAD", signal: controller.signal })
      .then((response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (active) {
          setStatus(response.ok && contentType.includes("application/pdf") ? "ready" : "missing");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("No se pudo verificar el PDF de investigación.", error);
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return status;
}

export default function Solution() {
  const researchPdfStatus = useResearchPdfStatus();

  return (
    <section className={styles.page}>
      <div className={`container ${styles.grid}`}>
        <div className={`${styles.copy} anim-fade-up`}>
          <SectionLabel>La solución</SectionLabel>
          <h1 className={styles.title}>Explora y compara posibles sitios de aterrizaje</h1>

          <div className={styles.statement}>
            <SectionLabel>Resumen ejecutivo</SectionLabel>
            <p>
              Lunar Site Explorer es una herramienta web educativa para explorar posibles sitios en
              el polo sur lunar. Reúne datos de terreno y cálculos astronómicos en una experiencia
              visual que ayuda a comparar condiciones por ubicación y fecha.
            </p>
          </div>

          <ul className={styles.capabilities}>
            {capabilities.map((capability) => (
              <li key={capability.title} className={styles.capability}>
                <span className={styles.capabilityIcon}>{capability.icon}</span>
                <div>
                  <h2 className={styles.capabilityTitle}>{capability.title}</h2>
                  <p className={styles.capabilityText}>{capability.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <Button to="/demo" variant="outline" icon={<ArrowRight size={16} />}>
            Explorar la demostración
          </Button>
        </div>

        <div className={styles.moon}>
          <MoonScene layout="solution" />
          <span className={styles.reticle} aria-hidden="true" />
        </div>

        <aside className={styles.side}>
          <div className={styles.coords}>
            <StatCard label="Zona de interés" value="Polo sur lunar" />
            <StatCard label="Criterios de análisis" value="Sol · Tierra" />
          </div>

          <GlassCard className={styles.summary} glow>
            <SectionLabel>Alcance del proyecto</SectionLabel>
            <h2 className={styles.summaryTitle}>Una vista integral del entorno lunar</h2>
            <p className={styles.summaryText}>
              Es un apoyo de exploración y aprendizaje, no una recomendación certificada para una misión.
            </p>
            <div className={styles.signal} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span className={styles.signalLabel}>NAVEGACIÓN LUNAR / 01</span>
          </GlassCard>
        </aside>
      </div>

      <div className={`container ${styles.details}`}>
        <div className={styles.detailsHeading}>
          <SectionLabel>La propuesta</SectionLabel>
          <h2>Una herramienta para explorar, comprender y comparar</h2>
        </div>

        <div className={styles.detailsGrid}>
          <article className={styles.detailCard}>
            <span className={styles.detailIcon}><Users size={20} /></span>
            <h3>¿A quién beneficia?</h3>
            <p>
              Su público principal son estudiantes, docentes y personas interesadas en astronomía,
              ciencias e ingeniería. También puede servir como apoyo visual para equipos educativos
              y para quienes investigan el entorno lunar en una etapa exploratoria.
            </p>
            <ul className={styles.detailList}>
              <li>Ayuda a relacionar topografía, iluminación y comunicación.</li>
              <li>Permite explorar ubicaciones y periodos desde una interfaz visual.</li>
              <li>Acerca datos y conceptos científicos a personas sin experiencia previa en navegación espacial.</li>
            </ul>
            <p>
              Su propósito es facilitar el aprendizaje y la comparación preliminar; no reemplaza
              herramientas de ingeniería ni la planificación de una misión.
            </p>
          </article>

          <article className={styles.detailCard}>
            <span className={styles.detailIcon}><Database size={20} /></span>
            <h3>Arquitectura y diseño</h3>
            <p>
              La interfaz está desarrollada con React y TypeScript. Recibe la selección de sitio y
              fechas, y presenta la información en mapas, gráficos y paneles para que los factores
              sean fáciles de explorar.
            </p>
            <p>
              El backend está escrito en Python y expone rutas mediante FastAPI. Desde allí se
              consultan las posiciones del Sol y la Tierra en JPL Horizons y se accede a los modelos
              digitales de elevación LOLA. La respuesta estructurada vuelve al frontend para
              actualizar las visualizaciones.
            </p>
            <div className={styles.architectureFlow} aria-label="Flujo de datos de la aplicación">
              <span>React · TypeScript</span>
              <span aria-hidden="true">→</span>
              <span>Python · FastAPI</span>
              <span aria-hidden="true">→</span>
              <span>Horizons · LOLA</span>
            </div>
          </article>

          <article className={styles.detailCard}>
            <span className={styles.detailIcon}><Mountain size={20} /></span>
            <h3>Investigación</h3>
            <p>
              La investigación parte de que ningún indicador describe por sí solo un posible sitio.
              Los atlas y datos de LOLA documentan el relieve; las efemérides de JPL Horizons
              permiten analizar la posición aparente del Sol y la Tierra en una fecha determinada.
            </p>
            <ul className={styles.detailList}>
              <li><strong>Terreno:</strong> elevación, cráteres, crestas y pendientes.</li>
              <li><strong>Iluminación:</strong> ángulo solar, sombras y disponibilidad de luz.</li>
              <li><strong>Comunicación:</strong> posición aparente de la Tierra y horizonte geométrico.</li>
            </ul>
            <p>
              El <em>Lunar South Pole Atlas</em> de Stopar y Kring (2010) aporta contexto
              cartográfico. Para Artemis III, NASA publicó 13 regiones candidatas en 2022 y Marín
              describió una actualización a nueve en 2024. Son referencias fechadas y de distinto
              tipo; por eso mostramos su procedencia y no las presentamos como una recomendación
              vigente para una misión.
            </p>
          </article>

          <article className={styles.detailCard}>
            <span className={styles.detailIcon}><Globe2 size={20} /></span>
            <h3>Escalabilidad</h3>
            <p>
              La arquitectura separa la interfaz, las rutas de la API y las consultas a las fuentes,
              lo que ofrece una base para ampliar el prototipo sin atribuirle capacidades que aún no
              tiene.
            </p>
            <ul className={styles.detailList}>
              <li>Incorporar modelos de elevación con mayor resolución y documentar su cobertura.</li>
              <li>Ampliar periodos y ubicaciones de consulta, considerando límites y disponibilidad de las APIs.</li>
              <li>Añadir criterios solo cuando existan datos, validaciones y una explicación de sus supuestos.</li>
            </ul>
            <p>
              Antes de afirmar capacidad para un número concreto de usuarios, sería necesario medir
              carga, tiempos de respuesta y límites de las fuentes externas.
            </p>
          </article>
        </div>

        <section className={styles.researchPdf} aria-labelledby="research-pdf-title">
          <div className={styles.researchPdfHeader}>
            <div className={styles.researchPdfIntro}>
              <SectionLabel>Documento completo</SectionLabel>
              <h2 id="research-pdf-title">Investigación del proyecto</h2>
              <p>
                Consulta las ocho páginas de investigación y metodología que respaldan la propuesta.
              </p>
            </div>
            {researchPdfStatus === "ready" && (
              <a
                className={styles.researchPdfLink}
                href="/docs/investigacion.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir o descargar PDF
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>

          {researchPdfStatus === "ready" ? (
            <>
              <div className={styles.researchPdfViewer}>
                <iframe
                  src="/docs/investigacion.pdf#view=FitH"
                  title="Documento de investigación de Lunar Site Explorer"
                  loading="lazy"
                />
              </div>

              <p className={styles.researchPdfHint}>
                Si el visor no está disponible en tu navegador,{" "}
                <a href="/docs/investigacion.pdf" target="_blank" rel="noopener noreferrer">
                  abre el PDF en una pestaña nueva
                </a>
                .
              </p>
            </>
          ) : (
            <p
              className={styles.researchPdfHint}
              role={researchPdfStatus === "error" ? "alert" : "status"}
            >
              {researchPdfStatus === "checking"
                ? "Comprobando si el documento está disponible…"
                : researchPdfStatus === "missing"
                  ? "Agrega el archivo como frontend/public/docs/investigacion.pdf para mostrarlo aquí."
                  : "No se pudo comprobar el documento. Revisa la conexión y vuelve a cargar la página."}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
