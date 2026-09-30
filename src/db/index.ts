import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL (ver .env.example)");

// Reutiliza la conexión entre recargas en desarrollo.
const globalForDb = globalThis as unknown as { pg?: postgres.Sql };

// `prepare: false` es requerido por el pooler de Supabase en modo transacción (Vercel serverless).
const client = globalForDb.pg ?? postgres(url, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
