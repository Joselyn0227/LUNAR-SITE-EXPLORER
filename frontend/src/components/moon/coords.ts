export type Polo = "norte" | "sur";

export const R_LUNA_KM = 1737.4;
const RAD = Math.PI / 180;

export interface PuntoLibre {
  lat: number;
  lon: number;          // -180..180, este positivo
}

// Longitud al rango -180..180 (este positivo), que es lo que espera la API
export function normalizarLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function redondear(valor: number, decimales = 4): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

// Radio (km) de un paralelo en el mapa polar, con escala verdadera en el polo
export function radioPolarKm(latBorde: number): number {
  return 2 * R_LUNA_KM * Math.tan(((90 - latBorde) / 2) * RAD);
}

// lat/lon -> [y, x] en km, para L.CRS.Simple
export function polarAXY(
  lat: number,
  lon: number,
  polo: Polo,
  rotacionDeg: number,
): [number, number] {
  const colat = (polo === "norte" ? 90 - lat : 90 + lat) * RAD;
  const rho = 2 * R_LUNA_KM * Math.tan(colat / 2);
  const lam = (lon + rotacionDeg) * RAD;
  const signo = polo === "norte" ? -1 : 1;
  return [signo * rho * Math.cos(lam), rho * Math.sin(lam)];
}

// [y, x] en km -> lat/lon
export function polarALatLon(
  y: number,
  x: number,
  polo: Polo,
  rotacionDeg: number,
): PuntoLibre {
  const rho = Math.hypot(x, y);
  const colat = (2 * Math.atan(rho / (2 * R_LUNA_KM))) / RAD;
  const lat = polo === "norte" ? 90 - colat : colat - 90;
  const lam = Math.atan2(x, polo === "norte" ? -y : y) / RAD;
  return { lat: redondear(lat), lon: redondear(normalizarLon(lam - rotacionDeg)) };
}

// "89.90° S · 12.50° E"
export function formatoCoords(lat: number, lon: number): string {
  const ns = lat < 0 ? "S" : "N";
  const eo = lon < 0 ? "O" : "E";
  return `${Math.abs(lat).toFixed(2)}° ${ns} · ${Math.abs(lon).toFixed(2)}° ${eo}`;
}