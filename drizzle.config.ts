import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  // Para migraciones usar la conexión directa / session pooler (puerto 5432), no la de transacción.
  dbCredentials: { url: process.env.DATABASE_URL_MIGRACIONES ?? process.env.DATABASE_URL! },
  // Ignora las tablas internas de PostGIS al hacer push/introspect.
  extensionsFilters: ["postgis"],
});
