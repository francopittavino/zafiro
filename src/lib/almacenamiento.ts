import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Archivos en Supabase Storage: bucket privado "fotos" (drizzle/0005_fotos.sql) y "documentos"
 * (PDF de la receta oficial, drizzle/0007). Solo el servidor tiene la clave; el navegador ve
 * los archivos con URLs firmadas que vencen.
 */

export type Bucket = "fotos" | "documentos";
/** Cuánto duran los links para ver las fotos. */
const DURACION_URL_SEGUNDOS = 60 * 60;

let cliente: SupabaseClient | null = null;

/** Error de configuración (variables mal cargadas): se muestra tal cual en la pantalla. */
export class ErrorAlmacenamiento extends Error {}

function storage(bucket: Bucket) {
  const url = process.env.SUPABASE_URL?.trim();
  const clave = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !clave) return null;
  // Error común: pegar la clave en SUPABASE_URL (o al revés).
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
    throw new ErrorAlmacenamiento(
      "SUPABASE_URL no es una dirección válida: tiene que ser https://<proyecto>.supabase.co (revisá las variables en Vercel).",
    );
  cliente ??= createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente.storage.from(bucket);
}

/** Pasa el error de Supabase a un mensaje entendible. */
function falla(error: { message?: string; statusCode?: string | number }): never {
  const codigo = String(error.statusCode ?? "");
  if (codigo === "401" || codigo === "403" || /signature|jwt|invalid.*key|unauthorized/i.test(error.message ?? ""))
    throw new ErrorAlmacenamiento("La clave SUPABASE_SECRET_KEY no es válida (revisá las variables en Vercel).");
  throw new ErrorAlmacenamiento(`No se pudo usar el almacenamiento: ${error.message ?? "error desconocido"}.`);
}

/** False si faltan SUPABASE_URL / SUPABASE_SECRET_KEY (la galería muestra cómo configurarlo). */
export const fotosConfiguradas = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

export async function subirArchivo(ruta: string, archivo: Blob, bucket: Bucket = "fotos") {
  const s = storage(bucket);
  if (!s) throw new ErrorAlmacenamiento("Falta configurar el almacenamiento (SUPABASE_URL y SUPABASE_SECRET_KEY).");
  const { error } = await s.upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) falla(error);
}

export async function borrarArchivo(ruta: string, bucket: Bucket = "fotos") {
  const s = storage(bucket);
  if (!s) return;
  const { error } = await s.remove([ruta]);
  if (error) falla(error);
}

/** Baja un archivo (ej. el PDF oficial, para unirlo al resumen de la receta). */
export async function descargarArchivo(ruta: string, bucket: Bucket = "fotos") {
  const s = storage(bucket);
  if (!s) throw new ErrorAlmacenamiento("Falta configurar el almacenamiento (SUPABASE_URL y SUPABASE_SECRET_KEY).");
  const { data, error } = await s.download(ruta);
  if (error) falla(error);
  return new Uint8Array(await data.arrayBuffer());
}

/** URLs firmadas para mostrar varios archivos de una (ruta → url). */
export async function urlsFirmadas(rutas: string[], bucket: Bucket = "fotos") {
  if (rutas.length === 0) return new Map<string, string>();
  const s = storage(bucket);
  if (!s) return new Map<string, string>();
  const { data, error } = await s.createSignedUrls(rutas, DURACION_URL_SEGUNDOS);
  if (error) falla(error);
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl as string]));
}

/** Mensaje para mostrar de un error al usar el almacenamiento. */
export const mensajeAlmacenamiento = (error: unknown) =>
  error instanceof ErrorAlmacenamiento ? error.message : "No se pudo conectar con el almacenamiento de fotos.";
