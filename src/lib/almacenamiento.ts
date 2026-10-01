import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Archivos en Supabase Storage (bucket privado "fotos", creado en drizzle/0005_fotos.sql).
 * Solo el servidor tiene la clave; el navegador ve las fotos con URLs firmadas que vencen.
 */

const BUCKET = "fotos";
/** Cuánto duran los links para ver las fotos. */
const DURACION_URL_SEGUNDOS = 60 * 60;

let cliente: SupabaseClient | null = null;

function storage() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) return null;
  cliente ??= createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente.storage.from(BUCKET);
}

/** False si faltan SUPABASE_URL / SUPABASE_SECRET_KEY (la galería muestra cómo configurarlo). */
export const fotosConfiguradas = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

export async function subirArchivo(ruta: string, archivo: Blob) {
  const s = storage();
  if (!s) throw new Error("Storage no configurado");
  const { error } = await s.upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw error;
}

export async function borrarArchivo(ruta: string) {
  const s = storage();
  if (!s) return;
  const { error } = await s.remove([ruta]);
  if (error) throw error;
}

/** URLs firmadas para mostrar varias fotos de una (ruta → url). */
export async function urlsFirmadas(rutas: string[]) {
  const s = storage();
  if (!s || rutas.length === 0) return new Map<string, string>();
  const { data, error } = await s.createSignedUrls(rutas, DURACION_URL_SEGUNDOS);
  if (error) throw error;
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
}
