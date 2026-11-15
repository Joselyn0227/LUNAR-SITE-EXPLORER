import { MapPin, RadioTower } from "lucide-react";
import type { FormEventHandler } from "react";
import styles from "./SitesPanel.module.css";
import type { Zona } from "../../../data/ExampleSites";

export type SiteFilter = "site" | "coordinate";

interface SitesPanelProps {
  sites: Zona[];
  selectedId: number;
  filter: SiteFilter;
  onFilterChange: (filter: SiteFilter) => void;
  onSelect: (id: number) => void;
  onFormSubmit?: FormEventHandler<HTMLFormElement>;
}

const filters: { value: SiteFilter; label: string }[] = [
  { value: "site", label: "Sitios" },
  { value: "coordinate", label: "Coordenadas" },
];

export default function SitesPanel({
  sites,
  selectedId,
  filter,
  onFormSubmit,
  onFilterChange,
  onSelect,
}: SitesPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Puntos de interés">
      <div className={styles.sectionTitle}>
        <MapPin size={13} /> PUNTOS DE INTERÉS
      </div>

      <div
        className={styles.filters}
        role="group"
        aria-label="Filtrar puntos de interés"
      >
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? styles.filterActive : ""}
            aria-pressed={filter === item.value}
            onClick={() => onFilterChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

        {sites.length > 0 ? (

      <ul className={styles.siteList}>
        {sites.map((site) => (
          <li key={site.id}>
            <button
              type="button"
              className={`${styles.site} ${site.id === selectedId ? styles.selected : ""}`}
              onClick={() => onSelect(site.id)}
              aria-pressed={site.id === selectedId}
            >
              <span className={styles.thumbnail} />
              <span className={styles.siteCopy}>
                <strong>{site.nombre}</strong>
                <small>lat: {site.latitud}</small>
                <small>lon: {site.longitud_este}</small>
              </span>
              <span
                className={`${styles.status} ${styles[site.tipo]}`}
                aria-label={site.tipo}
              />
            </button>
          </li>
        ))}
      </ul>
        ) :(
          <form className={styles.formCoordinates} onSubmit={onFormSubmit}>
            <h1>ESPECIFIQUE SU PUNTO DE INTERES</h1>
            <label htmlFor="lat">
              Longitud
              <input step="any" id="lat" name="lat" type="number" placeholder="Latitud" />
            </label>
            <label htmlFor="lon">
              Latitud
              <input step="any" id="lon" name="lon" type="number" placeholder="Longitud" />
            </label>
            <button type="submit">IR</button>
          </form>
        )}


      <div className={styles.legend}>
        <RadioTower size={13} /> POSIBLES SITIOS DE ATERRIZAJE
      </div>
    </aside>
  );
}
