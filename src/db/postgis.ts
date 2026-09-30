import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Polígono GeoJSON (lo que se obtiene al convertir un KML/KMZ de Google Earth). */
export type GeoJsonPoligono = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

/**
 * Columna PostGIS `geometry(MultiPolygon, 4326)` para el contorno de los lotes.
 *
 * - Escritura: recibe GeoJSON y lo convierte en la base (ST_GeomFromGeoJSON).
 *   Un Polygon simple se guarda como MultiPolygon (ST_Multi).
 * - Lectura: Postgres devuelve la geometría en EWKB hexadecimal. Para obtener
 *   GeoJSON, seleccionar con `sql<string>\`ST_AsGeoJSON(${lotes.contorno})\``.
 */
export const multiPoligono = customType<{
  data: GeoJsonPoligono;
  driverData: string;
}>({
  dataType() {
    return "geometry(MultiPolygon, 4326)";
  },
  toDriver(value) {
    return sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), 4326))`;
  },
});
