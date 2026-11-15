import { ExternalLink } from "lucide-react";
import { SectionLabel } from "../../components/ui/SectionLabel";
import styles from "./Sources.module.css";

const sources = [
  {
    id: "atlas",
    category: "Atlas lunar",
    title: "Lunar South Pole Atlas",
    organization: "J. D. Stopar y D. A. Kring · Lunar and Planetary Institute / USRA · 2010",
    description:
      "Atlas de referencia para explorar rasgos y regiones del polo sur lunar. Las tres entradas repetidas en el documento corresponden al mismo atlas y se consolidan aquí.",
    href: "https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/",
    linkText: "Consultar el atlas",
  },
  {
    id: "marin",
    category: "Contexto de exploración",
    title: "Las nueve zonas de aterrizaje de Artemisa III en el polo sur de la Luna",
    organization: "Daniel Marín · Eureka · 29 de octubre de 2024",
    description:
      "Artículo de divulgación sobre las zonas candidatas anunciadas para Artemis III. Se incluye como contexto editorial y se distingue de los datos topográficos y astronómicos usados por la aplicación.",
    href: "https://danielmarin.naukas.com/2024/10/29/las-nueve-zonas-de-aterrizaje-de-artemisa-iii-en-el-polo-sur-de-la-luna/",
    linkText: "Leer el artículo",
  },
  {
    id: "lola",
    category: "Instrumento y datos topográficos",
    title: "LOLA — Lunar Orbiter Laser Altimeter",
    organization: "J. Brill · NASA Science · 26 de enero de 2024",
    description:
      "Descripción del instrumento LOLA, que mide la elevación de la superficie lunar desde la misión Lunar Reconnaissance Orbiter.",
    href: "https://science.nasa.gov/mission/lro/lola/",
    linkText: "Ver LOLA en NASA Science",
  },
  {
    id: "lola-archive",
    category: "Archivo de datos",
    title: "LOLA Data — Planetary Data System",
    organization: "NASA · PDS Geosciences Node",
    description:
      "Portal de datos de LOLA de la misión LRO, con productos utilizados para estudiar la topografía lunar.",
    href: "https://pds-geosciences.wustl.edu/missions/lro/lola.htm",
    linkText: "Consultar el archivo LOLA",
  },
  {
    id: "horizons",
    category: "Efemérides",
    title: "Horizons System",
    organization: "NASA Jet Propulsion Laboratory",
    description:
      "Servicio de efemérides del JPL usado para consultar posiciones astronómicas del Sol y la Tierra para ubicaciones y fechas determinadas.",
    href: "https://ssd.jpl.nasa.gov/horizons/",
    linkText: "Abrir JPL Horizons",
  },
  {
    id: "svs-moon-kit",
    category: "Recurso visual",
    title: "SVS: CGI Moon Kit",
    organization: "NASA Scientific Visualization Studio · 6 de septiembre de 2019",
    description:
      "Recurso visual citado por el equipo como apoyo para representar la Luna. No es una fuente de efemérides ni un conjunto de datos topográficos.",
    href: "https://svs.gsfc.nasa.gov/4720",
    linkText: "Ver el recurso de NASA SVS",
  },
  {
    id: "artemis",
    category: "Contexto de exploración",
    title: "Candidate Regions for Landing Next Americans on Moon",
    organization: "V. Lloyd, A. Johnson y K. Hambleton · NASA · 19 de agosto de 2022",
    description:
      "Publicación de contexto sobre la selección de regiones candidatas cerca del polo sur para Artemis III. Describe información publicada en 2022 y no debe interpretarse como una lista operacional vigente.",
    href: "https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/",
    linkText: "Leer la publicación de NASA",
  },
];

export default function Sources() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <SectionLabel>Transparencia y documentación</SectionLabel>
        <h1>Fuentes de datos y referencias</h1>
        <p>
          Estas fuentes respaldan la información topográfica y astronómica que se explora en
          Lunar Site Explorer, además del contexto y los recursos visuales de la exploración del
          polo sur lunar. Las entradas repetidas en el documento se muestran una sola vez.
        </p>
      </header>

      <div className={styles.sourceGrid}>
        {sources.map((source) => (
          <article className={styles.sourceCard} id={source.id} key={source.id}>
            <span className={styles.category}>{source.category}</span>
            <h2>{source.title}</h2>
            <p className={styles.organization}>{source.organization}</p>
            <p className={styles.description}>{source.description}</p>
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.linkText}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>

      <p className={styles.note}>
        Lunar Site Explorer es una herramienta educativa y de análisis preliminar. Las fuentes
        enlazadas no convierten sus resultados en recomendaciones certificadas para una misión.
      </p>
    </section>
  );
}
