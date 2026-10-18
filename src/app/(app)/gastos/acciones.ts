"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import { gastos } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { SIN_CULTIVO, campaniaDeNombre, cicloParaRegistro } from "@/lib/ciclos";
import { campaniaSugerida } from "@/lib/formato";
import { modoDemo } from "@/lib/modo-demo";
import type { ResultadoAlta } from "../acciones-catalogos";

export type DatosGasto = {
  /** A qué se carga: un lote, un campo entero (se reparte por ha) o la campaña en general. */
  destino: { tipo: "lote" | "campo" | "general"; id?: number };
  categoriaId: number;
  fecha: string;
  descripcion: string;
  importe: number;
};

function validar(g: DatosGasto) {
  if (!["lote", "campo", "general"].includes(g.destino?.tipo)) return "Elegí a qué se carga el gasto.";
  if (g.destino.tipo !== "general" && !Number.isInteger(g.destino.id)) return "Elegí el lote o el campo.";
  if (!Number.isInteger(g.categoriaId)) return "Elegí la categoría.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha) || Number.isNaN(Date.parse(g.fecha))) return "La fecha no es válida.";
  if (!(typeof g.importe === "number" && Number.isFinite(g.importe) && g.importe >= 0))
    return "El importe tiene que ser un número mayor o igual a 0.";
  return null;
}

export async function guardarGasto(datos: DatosGasto, gastoId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const error = validar(datos);
  if (error) return { ok: false, error };
  if (gastoId !== undefined && !Number.isInteger(gastoId)) return { ok: false, error: "Gasto inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  // El gasto de un lote va a su cultivo (y a la campaña de ese cultivo); el de un campo o
  // general, a la campaña actual.
  let ciclo: { id: number; campaniaId: number } | null = null;
  if (datos.destino.tipo === "lote") {
    const anterior =
      gastoId === undefined
        ? undefined
        : (await db.select({ cicloId: gastos.cicloId }).from(gastos).where(eq(gastos.id, gastoId)))[0]?.cicloId;
    ciclo = await cicloParaRegistro(db, datos.destino.id!, anterior);
    if (!ciclo) return { ok: false, error: SIN_CULTIVO };
  }
  // Sin campañas todavía, el gasto de un campo o general va a la campaña de la fecha de hoy.
  const campania = (await campaniaActual()) ?? { id: await campaniaDeNombre(db, campaniaSugerida()) };

  const id = await dbTx.transaction(async (tx) => {
    const valores = {
      campaniaId: ciclo?.campaniaId ?? campania.id,
      cicloId: ciclo?.id ?? null,
      campoId: datos.destino.tipo === "campo" ? datos.destino.id! : null,
      categoriaId: datos.categoriaId,
      fecha: datos.fecha,
      descripcion: datos.descripcion.trim() || null,
      importeUsd: String(datos.importe),
    };
    if (gastoId !== undefined) {
      await tx.update(gastos).set(valores).where(eq(gastos.id, gastoId));
      return gastoId;
    }
    const [fila] = await tx.insert(gastos).values(valores).returning({ id: gastos.id });
    return fila.id;
  });
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function eliminarGasto(id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Gasto inválido." };
  if (modoDemo()) return { ok: true, demo: true };
  await db.delete(gastos).where(eq(gastos.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
