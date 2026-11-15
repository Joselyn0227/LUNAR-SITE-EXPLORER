export type SiteKind = "site" | "coordinate";

export interface Zona {
  id: number;
  nombre: string;
  latitud: number;
  longitud_este: number;
  tipo: string;
  altura_m: number;
}

export interface ExampleSites {
  zonas: Zona[];
}

export const exampleSites: ExampleSites = {
  zonas: [
    {
      id: 1,
      nombre: "Peak Near Shackleton (sitio A)",
      latitud: -88.81,
      longitud_este: 123.76,
      tipo: "Elevación",
      altura_m: 1200
    },
    {
      id: 2,
      nombre: "Peak Near Shackleton (sitio B)",
      latitud: -88.86,
      longitud_este: 132.19,
      tipo: "Elevación",
      altura_m: 1350
    },
    {
      id: 3,
      nombre: "Connecting Ridge (región central)",
      latitud: -89.54,
      longitud_este: 209.95,
      tipo: "Elevación",
      altura_m: 900
    },
    {
      id: 4,
      nombre: "Connecting Ridge Extension",
      latitud: -89.10,
      longitud_este: 211.40,
      tipo: "Elevación",
      altura_m: 1100
    },
    {
      id: 5,
      nombre: "Malapert Massif (plataforma norte)",
      latitud: -86.00,
      longitud_este: 21.10,
      tipo: "Macizo",
      altura_m: 4500
    },
    {
      id: 6,
      nombre: "Malapert Massif (meseta sur)",
      latitud: -88.45,
      longitud_este: 20.50,
      tipo: "Macizo",
      altura_m: 4800
    },
    {
      id: 7,
      nombre: "Leibnitz Beta Plateau (sector 1)",
      latitud: -85.00,
      longitud_este: 65.00,
      tipo: "Meseta",
      altura_m: 3500
    },
    {
      id: 8,
      nombre: "Leibnitz Beta Plateau (sector 2)",
      latitud: -85.20,
      longitud_este: 67.20,
      tipo: "Meseta",
      altura_m: 3800
    },
    {
      id: 9,
      nombre: "Faustini Rim A (cresta este)",
      latitud: -87.20,
      longitud_este: 75.00,
      tipo: "Cresta",
      altura_m: 1000
    },
    {
      id: 10,
      nombre: "Faustini Rim A (cresta oeste)",
      latitud: -87.50,
      longitud_este: 72.80,
      tipo: "Cresta",
      altura_m: 900
    },
    {
      id: 11,
      nombre: "de Gerlache Rim 1 (sector Alpha)",
      latitud: -88.50,
      longitud_este: 230.00,
      tipo: "Borde",
      altura_m: 1250
    },
    {
      id: 12,
      nombre: "de Gerlache Rim 1 (sector Beta)",
      latitud: -88.10,
      longitud_este: 228.40,
      tipo: "Borde",
      altura_m: 1150
    },
    {
      id: 13,
      nombre: "de Gerlache Rim 2 (sector principal)",
      latitud: -87.80,
      longitud_este: 225.00,
      tipo: "Borde",
      altura_m: 1000
    },
    {
      id: 14,
      nombre: "de Gerlache-Kocher Massif",
      latitud: -84.80,
      longitud_este: 238.00,
      tipo: "Macizo",
      altura_m: 3200
    },
    {
      id: 15,
      nombre: "Haworth (costa sur)",
      latitud: -86.80,
      longitud_este: 338.33,
      tipo: "Cresta",
      altura_m: 1400
    },
    {
      id: 16,
      nombre: "Nobile Rim 1 (zona de rover)",
      latitud: -85.20,
      longitud_este: 34.40,
      tipo: "Meseta",
      altura_m: 800
    },
    {
      id: 17,
      nombre: "Nobile Rim 1 (sitio ORU, proxy)",
      latitud: -85.46,
      longitud_este: 36.36,
      tipo: "Planicie",
      altura_m: 750
    },
    {
      id: 18,
      nombre: "Nobile Rim 2 (meseta adyacente)",
      latitud: -84.50,
      longitud_este: 32.00,
      tipo: "Meseta",
      altura_m: 600
    },
    {
      id: 19,
      nombre: "Amundsen Rim (borde interior)",
      latitud: -84.20,
      longitud_este: 82.50,
      tipo: "Borde",
      altura_m: 1500
    },
    {
      id: 20,
      nombre: "Amundsen-Gerlache Crater Ridge",
      latitud: -83.90,
      longitud_este: 85.00,
      tipo: "Cresta",
      altura_m: 1300
    }
  ]
};