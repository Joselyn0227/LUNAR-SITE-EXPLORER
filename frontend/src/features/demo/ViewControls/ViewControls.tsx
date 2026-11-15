
import styles from "./ViewControls.module.css";

export type MoonView = "2D" | "3D" | "superficie";

interface ViewControlsProps {
  view: MoonView;
  onViewChange: (view: MoonView) => void;
}

const MODOS: { value: MoonView; label: string }[] = [
  { value: "2D", label: "2D" },
  { value: "3D", label: "3D" },
  { value: "superficie", label: "Superficie" },
];

export default function ViewControls({
  view,
  onViewChange,
}: ViewControlsProps) {

  return (
    <div className={styles.controls}>
      <div
        className={styles.viewGroup}
        role="group"
        aria-label="Modo de visualización"
      >
        {MODOS.map((mode) => (
          <button
            type="button"
            key={mode.value}
            className={view === mode.value ? styles.active : ""}
            aria-pressed={view === mode.value}
            onClick={() => onViewChange(mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}