export interface Seleccion {
  lat: number;
  lon: number;          // -180..180, este positivo
  nombre?: string;
  sitioId?: number;
}

export interface Sitio {
  id: number;
  nombre: string;
  lat: number;
  lon: number;          // -180..180, este positivo
  tipo: string;
}