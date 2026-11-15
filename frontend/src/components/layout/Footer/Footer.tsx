import { GitFork } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <span className={styles.project}>Astronomía del María 1</span>
        <span className={styles.challenge}>NASA SPACE APPS CHALLENGE 2026</span>
        <Link className={styles.sources} to="/fuentes">
          Fuentes de datos
        </Link>
        <a
          className={styles.github}
          href="https://github.com/Joselyn0227/LUNAR-SITE-EXPLORER"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Repositorio de Lunar Site Explorer en GitHub"
        >
          <GitFork size={18} aria-hidden="true" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}