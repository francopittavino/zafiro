"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campos, fotos, lotes } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import { borrarArchivo, fotosConfiguradas, subirArchivo } from "@/lib/almacenamiento";

type Resultado = { ok: true } | { ok: false; error: string };

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
/** El navegador achica la foto antes de mandarla; esto es solo un tope. */
const TAMANIO_MAXIMO = 4 * 1024 * 1024;

const entero = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Sube una foto (ya achicada en el navegador) a un campo o lote. */
export async function subirFoto(formulario: FormData): Promise<Resultado> {
  await verificarSesion();
  if (modoDemo()) return { ok: false, error: "En el modo demo no se pueden cargar fotos." };
  if (!fotosConfiguradas()) return { ok: false, error: "Falta configurar el almacenamiento de fotos." };

  const tipo = formulario.get("tipo");
  const destinoId = entero(formulario.get("destinoId"));
  const archivo = formulario.get("archivo");
  const fecha = String(formulario.get("fecha") ?? "");
  const nota = String(formulario.get("nota") ?? "").trim() || null;

  if ((tipo !== "campo" && tipo !== "lote") || !destinoId) return { ok: false, error: "Destino inválido." };
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elegí una foto." };
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) return { ok: false, error: "El archivo tiene que ser una imagen (JPG, PNG o WEBP)." };
  if (archivo.size > TAMANIO_MAXIMO) return { ok: false, error: "La foto es demasiado grande (máximo 4 MB)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
    return { ok: false, error: "La fecha no es válida." };

  const tabla = tipo === "campo" ? campos : lotes;
  const [existe] = await db.select({ id: tabla.id }).from(tabla).where(eq(tabla.id, destinoId));
  if (!existe) return { ok: false, error: `El ${tipo} ya no existe.` };

  const extension = archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
  const ruta = `${tipo}s/${destinoId}/${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;

  await subirArchivo(ruta, archivo);
  try {
    await db.insert(fotos).values({
      ruta,
      fecha,
      nota,
      ancho: entero(formulario.get("ancho")),
      alto: entero(formulario.get("alto")),
      campoId: tipo === "campo" ? destinoId : null,
      loteId: tipo === "lote" ? destinoId : null,
    });
  } catch (error) {
    // Si no se pudo registrar, no dejar el archivo huérfano en el bucket.
    await borrarArchivo(ruta).catch(() => {});
    throw error;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Borra la foto (registro y archivo). */
export async function eliminarFoto(id: number): Promise<Resultado> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Foto inválida." };
  if (modoDemo()) return { ok: false, error: "En el modo demo no se pueden borrar fotos." };

  const [foto] = await db.delete(fotos).where(eq(fotos.id, id)).returning({ ruta: fotos.ruta });
  if (foto) await borrarArchivo(foto.ruta);
  revalidatePath("/", "layout");
  return { ok: true };
}
