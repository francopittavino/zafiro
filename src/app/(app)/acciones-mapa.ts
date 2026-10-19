"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fotos, lotes } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import { dibujoValido } from "@/lib/dibujo";
import { obtenerDatos } from "@/lib/datos";
import { esMapaDelCampo, mapasDeCampos, type FotoMapa } from "@/lib/fotos";
import type { LoteMapa } from "@/components/app/mapa";
import type { ResultadoAlta } from "./acciones-catalogos";

/** Mapas de un campo con sus lotes, para marcar un lote desde su formulario. */
export async function mapaParaMarcar(campoId: number): Promise<{ mapas: FotoMapa[]; lotes: LoteMapa[] }> {
  await verificarSesion();
  if (!Number.isInteger(campoId)) return { mapas: [], lotes: [] };
  const datos = await obtenerDatos();
  return {
    mapas: await mapasDeCampos([campoId]),
    lotes: datos.lotes
      .filter((l) => l.campoId === campoId)
      .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo, mapaId: l.mapaId })),
  };
}

/**
 * Suma una de las fotos del campo a sus mapas (`esMapa` true) o la saca (false).
 * Al sacarla, los lotes marcados sobre ella quedan sin marcar (la foto sigue en la galería).
 */
export async function usarComoMapa(campoId: number, fotoId: number, esMapa: boolean): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(campoId) || !Number.isInteger(fotoId)) return { ok: false, error: "Datos inválidos." };
  if (modoDemo()) return { ok: true, demo: true };

  const [foto] = await db
    .select({ id: fotos.id })
    .from(fotos)
    .where(and(eq(fotos.id, fotoId), eq(fotos.campoId, campoId)));
  if (!foto) return { ok: false, error: "La foto no es de este campo." };
  await db.update(fotos).set({ esMapa }).where(eq(fotos.id, fotoId));
  if (!esMapa) await db.update(lotes).set({ dibujo: null, mapaId: null }).where(eq(lotes.mapaId, fotoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Guarda el contorno del lote marcado sobre uno de los mapas del campo (null lo borra). */
export async function guardarDibujoLote(loteId: number, dibujo: unknown, mapaId: number | null): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (dibujo !== null && (!dibujoValido(dibujo) || !Number.isInteger(mapaId)))
    return { ok: false, error: "Marcá al menos 3 puntos." };
  if (modoDemo()) return { ok: true, demo: true };

  if (dibujo !== null) {
    const [lote] = await db.select({ campoId: lotes.campoId }).from(lotes).where(eq(lotes.id, loteId));
    if (!lote || !(await esMapaDelCampo(mapaId!, lote.campoId))) return { ok: false, error: "El mapa no es de este campo." };
  }
  await db
    .update(lotes)
    .set(dibujo === null ? { dibujo: null, mapaId: null } : { dibujo, mapaId })
    .where(eq(lotes.id, loteId));
  revalidatePath("/", "layout");
  return { ok: true };
}
