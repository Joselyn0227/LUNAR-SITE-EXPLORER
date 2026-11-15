const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export async function fetchLunarElevation(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<number> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const response = await fetch(`${API_BASE_URL}/luna/elevacion?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`La API lunar respondió con HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("elevacion_m" in payload) ||
    typeof payload.elevacion_m !== "number" ||
    !Number.isFinite(payload.elevacion_m)
  ) {
    throw new Error("La API lunar devolvió una elevación no válida.");
  }

  return payload.elevacion_m;
}