export const API_ROUTES = {
  TERRENO: (
    lat: number,
    lon: number,
    radio_km = 25,
    n = 257,
  ) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radio_km: String(radio_km),
      n: String(n),
    });

    return `/api/luna/terreno?${params.toString()}`;
  },

  ELEVACION: (lat: number, lon: number) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });

    return `/api/luna/elevacion?${params.toString()}`;
  },

  CIELO: (
    lat: number,
    lon: number,
    fecha_inicio: string,
    fecha_fin: string,
    alt_m?: number,
    paso = "1 h",
    tz = "America/Bogota",
  ) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      fecha_inicio,
      fecha_fin,
      paso,
      tz,
    });

    if (alt_m !== undefined) {
      params.set("alt_m", String(alt_m));
    }

    return `/api/luna/cielo?${params.toString()}`;
  },
} as const;
