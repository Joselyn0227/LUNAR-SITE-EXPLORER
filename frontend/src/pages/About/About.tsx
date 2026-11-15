import { ArrowRight, Orbit, Rocket, Telescope } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatCard } from "../../components/ui/StatCard";
import MoonScene from "../../components/moon/MoonScene";
import styles from "./About.module.css";

const principles = [
  {
    icon: <Telescope size={20} />,
    title: "Explorar",
    text: "Acercar la exploración del polo sur lunar a través de una experiencia visual e interactiva.",
  },
  {
    icon: <Orbit size={20} />,
    title: "Conectar factores",
    text: "Poner en contexto la posición del Sol y de la Tierra al evaluar posibles zonas de aterrizaje.",
  },
];

const team = [
  {
    name: "Luis Miguel Pérez Uribe",
    role: "Programación backend",
    photo: "luis.jpeg",
    initials: "LP",
  },
  {
    name: "Mariana Zuleta Trujillo",
    role: "Diseño e investigación",
    photo: "mariana.jpeg",
    initials: "MZ",
  },
  {
    name: "Valentina Martínez Ramírez",
    role: "Diseño e investigación",
    photo: "valentina.jpeg",
    initials: "VM",
  },
  {
    name: "Joselyn Nieva Morales",
    role: "Programación frontend · Integrante invitada del semillero",
    photo: "joselyn.jpeg",
    initials: "JN",
  },
  {
    name: "Kevin Andrés Cadavid Jaramillo",
    role: "Investigación y diseño",
    photo: "kevin.jpeg",
    initials: "KC",
  },
];

export default function About() {
  return (
    <section className={styles.page}>
      <div className={`container ${styles.grid}`}>
        <div className={`${styles.copy} anim-fade-up`}>
          <SectionLabel>Acerca de nosotros</SectionLabel>
          <h1 className={styles.title}>QUIÉNES SOMOS</h1>

          <div className={styles.statement}>
            <SectionLabel>Astronomía del María 1</SectionLabel>
            <p>
              Somos el Semillero de Astronomía del María 1, un grupo de estudiantes apasionados por la exploración espacial y la ciencia lunar. Nuestro objetivo es desarrollar herramientas que permitan a las personas explorar y analizar el polo sur lunar de manera interactiva y educativa.
            </p>
          </div>

          <ul className={styles.principles}>
            {principles.map((principle) => (
              <li key={principle.title} className={styles.principle}>
                <span className={styles.principleIcon}>{principle.icon}</span>
                <div>
                  <h2 className={styles.principleTitle}>{principle.title}</h2>
                  <p className={styles.principleText}>{principle.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <Button to="/solucion" variant="outline" icon={<ArrowRight size={16} />}>
            Conoce la solución
          </Button>
        </div>

        <div className={styles.moon}>
          <MoonScene layout="challenge" />
          <span className={styles.reticle} aria-hidden="true" />
        </div>

        <aside className={styles.side}>
          <div className={styles.coords}>
            <StatCard label="Equipo" value="Astronomía del María 1" />
            <StatCard label="Contexto" value="NASA Space Apps 2026" />
          </div>

          <GlassCard className={styles.projectCard} glow>
            <span className={styles.rocketIcon}><Rocket size={20} /></span>
            <SectionLabel>Nuestra misión y visión</SectionLabel>
            <h2 className={styles.projectTitle}>Descubrir nuevos horizontes</h2>
            <p className={styles.projectText}>
              -Facilitar la evaluación preliminar de sitios lunares combinando datos de LOLA y JPL Horizons en una aplicación web interactiva. Buscamos entender en nuestro semillero escolar los riesgos de aterrizaje y la importancia de la matemática espacial como un hobby grupal.
              -Convertirnos en un referente de divulgación que muestre cómo la topografía y la luz influyen en la exploración lunar. Proyectamos integrar modelos avanzados para enriquecer nuestro aprendizaje conjunto.
            </p>
            <div className={styles.projectFooter}>
              <span className={styles.statusDot} />
              <span>EXPLORACIÓN LUNAR</span>
            </div>
          </GlassCard>
        </aside>
      </div>

      <section className={`container ${styles.team}`} aria-labelledby="team-title">
        <SectionLabel>Semillero de Astronomía 1</SectionLabel>
        <h2 id="team-title" className={styles.teamTitle}>El equipo</h2>
        <ul className={styles.teamGrid}>
          {team.map((member) => (
            <li className={styles.teamMember} key={member.name}>
              <div className={styles.photoFrame}>
                <span className={styles.photoFallback} aria-hidden="true">
                  {member.initials}
                </span>
                <img
                  src={`/images/${member.photo}`}
                  alt={`Retrato de ${member.name}`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </div>
              <h3>{member.name}</h3>
              <p>{member.role}</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
