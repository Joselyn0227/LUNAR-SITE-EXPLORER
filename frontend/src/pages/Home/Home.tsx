import { useState } from "react";
import { ArrowRight, Play, Rocket } from "lucide-react";
import { Button } from "../../components/ui/Button";
import MoonScene from "../../components/moon/MoonScene";
import styles from "./Home.module.css";

export default function Home() {
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  return (
    <>
      <section className={styles.hero}>
        <MoonScene layout="hero" />
        <div className={styles.scrim} aria-hidden="true" />

        <div className={`container ${styles.content}`}>
          <div className={styles.copy}>
            <span className={`${styles.eyebrow} anim-fade-up`}>Astronomía del María 1</span>

            <h1 className={`${styles.title} anim-fade-up`} style={{ animationDelay: "80ms" }}>
              <span className={styles.line}>LUNAR SITE</span>
              <span className={`${styles.line} ${styles.accent}`}>{" "}EXPLORER</span>
            </h1>

            <p className={`${styles.lead} anim-fade-up`} style={{ animationDelay: "160ms" }}>
              ¿Cómo comparar posibles sitios de aterrizaje en el polo sur lunar cuando el relieve,
              la iluminación solar y la visibilidad de la Tierra cambian de un lugar a otro?
            </p>

            <div className={`${styles.badge} anim-fade-up`} style={{ animationDelay: "240ms" }}>
              <span className={styles.badgeIcon}>
                <Rocket size={18} />
              </span>
              <div className={styles.badgeText}>
                <span className={styles.badgeTitle}>NASA Space Apps Challenge 2026</span>
                <span className={styles.chip}>Lunar Landing Site Navigator</span>
              </div>
            </div>

            <div className={`${styles.actions} anim-fade-up`} style={{ animationDelay: "320ms" }}>
              <Button to="/reto" variant="outline" icon={<ArrowRight size={16} />}>
                Conoce el reto
              </Button>
              <Button to="/demo" variant="ghost" iconPosition="left" icon={<Play size={14} />}>
                Ver demostración
              </Button>
            </div>
          </div>

          <p className={styles.vertical} aria-hidden="true">
            Mejores decisiones para un futuro lunar
          </p>
        </div>

        <div className={`container ${styles.strip}`}>
          <span className={styles.stripText}>Astronomía del María 1 — Lunar Site Explorer</span>
          <div className={styles.pager}>
            <span className={styles.bars} aria-hidden="true">
              <span className={styles.on} />
              <span />
              <span />
            </span>
            <span>01 / 03</span>
          </div>
        </div>
      </section>

      <section className={styles.pitch} aria-labelledby="pitch-title">
        <div className={`container ${styles.pitchGrid}`}>
          <div className={styles.pitchCopy}>
            <span className={styles.eyebrow}>Video pitch</span>
            <h2 id="pitch-title" className={styles.pitchTitle}>
              Una herramienta para explorar el polo sur lunar
            </h2>
            <p className={styles.pitchText}>
              Conoce cómo Lunar Site Explorer reúne información topográfica y astronómica para
              visualizar factores que influyen en la selección de posibles sitios de aterrizaje.
            </p>
          </div>

          <div className={styles.videoFrame}>
            <video
              controls
              preload="metadata"
              aria-label="Video pitch de Lunar Site Explorer"
              onError={() => setVideoUnavailable(true)}
              onCanPlay={() => setVideoUnavailable(false)}
            >
              <source src="/video-pitch.mp4" type="video/mp4" />
              Tu navegador no admite la reproducción de video.
            </video>
            {videoUnavailable && (
              <p className={styles.videoPlaceholder} role="status">
                El video pitch estará disponible próximamente.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}