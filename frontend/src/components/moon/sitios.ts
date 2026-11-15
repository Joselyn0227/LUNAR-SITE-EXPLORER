import { exampleSites } from "../../data/ExampleSites";
import { normalizarLon } from "./coords";
import type { Sitio } from "./tipos";

export const SITIOS: Sitio[] = exampleSites.zonas.map((z) => ({
    id: z.id,
    nombre: z.nombre,
    lat: z.latitud,
    lon: normalizarLon(z.longitud_este),
    tipo: z.tipo
}))