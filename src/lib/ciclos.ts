import "server-only";
import { and, eq } from "drizzle-orm";
import { campanias, ciclos } from "@/db/schema";
import type { db, dbTx } from "@/db";

export type Tx = Parameters<Parameters<typeof dbTx.transaction>[0]>[0];
type Conexion = Tx | typeof db;

export const SIN_CULTIVO = "Ese lote no tiene un cultivo en curso: inicialo desde la ficha del lote.";

/** El cultivo en curso del lote (hay uno solo, o ninguno entre el cierre de uno y el inicio del siguiente). */
export async function cicloEnCurso(cx: Conexion, loteId: number) {
  const [ciclo] = await cx
    .select({ id: ciclos.id, campaniaId: ciclos.campaniaId })
    .from(ciclos)
    .where(and(eq(ciclos.loteId, loteId), eq(ciclos.estado, "en_curso")))
    .limit(1);
  return ciclo ?? null;
}

/**
 * Ciclo donde va un registro (labor, gasto, receta) del lote: al editar, si sigue en el
 * mismo lote, se queda en su ciclo (aunque ya esté cerrado); si no, va al cultivo en curso.
 */
export async function cicloParaRegistro(cx: Conexion, loteId: number, cicloAnterior?: number | null) {
  if (cicloAnterior) {
    const [anterior] = await cx
      .select({ id: ciclos.id, campaniaId: ciclos.campaniaId })
      .from(ciclos)
      .where(and(eq(ciclos.id, cicloAnterior), eq(ciclos.loteId, loteId)));
    if (anterior) return anterior;
  }
  return cicloEnCurso(cx, loteId);
}

/** Busca la campaña por nombre (ej. "2025/26") y la crea si es nueva. */
export async function campaniaDeNombre(cx: Conexion, nombre: string) {
  const limpio = nombre.trim();
  const [existente] = await cx.select({ id: campanias.id }).from(campanias).where(eq(campanias.nombre, limpio));
  if (existente) return existente.id;
  const [nueva] = await cx.insert(campanias).values({ nombre: limpio }).returning({ id: campanias.id });
  return nueva.id;
}

/** Nombre de campaña válido: "2025/26" o "2025". */
export const campaniaValida = (nombre: unknown) => typeof nombre === "string" && /^\d{4}(\/\d{2})?$/.test(nombre.trim());
