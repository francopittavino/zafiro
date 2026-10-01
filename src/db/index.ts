import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { modoDemo } from "@/lib/modo-demo";
import * as schema from "./schema";

// En modo demo no se consulta la base: alcanza con una URL de relleno (la conexión es perezosa).
const url = process.env.DATABASE_URL ?? (modoDemo() ? "postgres://demo@localhost/demo" : undefined);
if (!url) throw new Error("Falta DATABASE_URL (ver .env.example)");

// Reutiliza las conexiones entre recargas en desarrollo.
const globalForDb = globalThis as unknown as { pg?: postgres.Sql; pgTx?: postgres.Sql };

// Pooler de Supabase en modo transacción (Vercel serverless):
// - `prepare: false`: no soporta sentencias preparadas.
// - `max_pipeline: 0`: no soporta varias consultas seguidas por la misma conexión (pipelining):
//   con consultas en paralelo la página quedaba colgada. `max_pipeline` existe en postgres.js
//   pero no está en sus tipos, por eso va en una variable.
const opciones = { prepare: false, max_pipeline: 0 };
const client = globalForDb.pg ?? postgres(url, opciones);

// Con `max_pipeline: 0`, postgres.js no puede abrir transacciones en un pool (UNSAFE_TRANSACTION).
// Las transacciones van por un cliente aparte de una sola conexión: dentro de una transacción
// el pooler fija la conexión al servidor, así que ahí el pipelining no es un problema.
const clientTx = globalForDb.pgTx ?? postgres(url, { prepare: false, max: 1 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pg = client;
  globalForDb.pgTx = clientTx;
}

/** Para lecturas y escrituras sueltas. */
export const db = drizzle(client, { schema, casing: "snake_case" });

/** Solo para `dbTx.transaction(...)`. */
export const dbTx = drizzle(clientTx, { schema, casing: "snake_case" });
