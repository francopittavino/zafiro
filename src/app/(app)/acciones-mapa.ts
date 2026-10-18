"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { campos, fotos, lotes } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import { dibujoValido } from "@/lib/dibujo";
import { obtenerDatos } from "@/lib/datos";
import { mapasDeCampos, type FotoMapa } from "@/lib/fotos";
import type { LoteMapa } from "@/components/app/mapa";
import type { ResultadoAlta } from "./acciones-catalogos";

/** Foto del mapa de un campo con sus lotes, para marcar un lote desde su formulario (null si no tiene). */
export async function mapaParaMarcar(campoId: number): Promise<{ foto: FotoMapa; lotes: LoteMapa[] } | null> {
  await verificarSesion();
  if (!Number.isInteger(campoId)) return null;
  const datos = await obtenerDatos();
  const campo = datos.campos.find((c) => c.id === campoId);
  const foto = campo && (await mapasDeCampos([campo])).get(campo.id);
  if (!foto) return null;
  return {
    foto,
    lotes: datos.lotes
      .filter((l) => l.campoId === campoId)
      .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo })),
  };
}

/** Elige una de las fotos del campo como mapa (o ninguna, con null). */
export async function elegirFotoMapa(campoId: number, fotoId: number | null): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(campoId) || (fotoId !== null && !Number.isInteger(fotoId)))
    return { ok: false, error: "Datos inválidos." };
  if (modoDemo()) return { ok: true, demo: true };

  if (fotoId !== null) {
    const [foto] = await db
      .select({ id: fotos.id })
      .from(fotos)
      .where(and(eq(fotos.id, fotoId), eq(fotos.campoId, campoId)));
    if (!foto) return { ok: false, error: "La foto no es de este campo." };
  }
  await db.update(campos).set({ fotoMapaId: fotoId }).where(eq(campos.id, campoId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Guarda el contorno del lote marcado sobre la foto del campo (null lo borra). */
export async function guardarDibujoLote(loteId: number, dibujo: unknown): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (dibujo !== null && !dibujoValido(dibujo)) return { ok: false, error: "Marcá al menos 3 puntos." };
  if (modoDemo()) return { ok: true, demo: true };

  await db.update(lotes).set({ dibujo }).where(eq(lotes.id, loteId));
  revalidatePath("/", "layout");
  return { ok: true };
}
