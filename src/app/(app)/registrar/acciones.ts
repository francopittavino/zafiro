"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import { aportes, ciclos, laborInsumos, labores, lotes } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { modoDemo } from "@/lib/modo-demo";

export type DatosLabor = {
  loteId: number;
  fecha: string;
  tipoLaborId: number;
  ha: number;
  costoLaborHa: number | null;
  aporte: string | null;
  notas: string | null;
  insumos: { productoId: number; dosis: number; precio: number }[];
};

export type Resultado = { ok: true; demo?: boolean } | { ok: false; error: string };

const positivo = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
const noNegativo = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** Validación en el servidor: lo que llega del navegador no es confiable. */
function validar(labor: DatosLabor): string | null {
  if (!Number.isInteger(labor.loteId) || !Number.isInteger(labor.tipoLaborId)) return "Falta el lote o la labor.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(labor.fecha)) return "La fecha no es válida.";
  if (!positivo(labor.ha)) return "Las hectáreas tienen que ser mayores a 0.";
  if (labor.costoLaborHa !== null && !noNegativo(labor.costoLaborHa)) return "El costo de la labor no es válido.";
  if (!labor.insumos.every((i) => Number.isInteger(i.productoId) && positivo(i.dosis) && noNegativo(i.precio)))
    return "Revisá la dosis y el precio de los productos.";
  return null;
}

type Tx = Parameters<Parameters<typeof dbTx.transaction>[0]>[0];

/** El ciclo es el cultivo del lote en la campaña; si todavía no existe se crea. */
async function cicloDelLote(tx: Tx, loteId: number, campaniaId: number) {
  const [ciclo] = await tx
    .select({ id: ciclos.id })
    .from(ciclos)
    .where(and(eq(ciclos.loteId, loteId), eq(ciclos.campaniaId, campaniaId)))
    .limit(1);
  if (ciclo) return ciclo.id;

  const [lote] = await tx.select().from(lotes).where(eq(lotes.id, loteId));
  if (!lote) throw new Error("Lote inexistente");
  const [nuevo] = await tx
    .insert(ciclos)
    .values({ loteId: lote.id, campaniaId, cultivo: "Sin definir", superficieHa: lote.superficieHa })
    .returning({ id: ciclos.id });
  return nuevo.id;
}

/** Busca el aporte por nombre; si es uno nuevo (se escribió en el formulario), lo crea. */
async function aporteDeNombre(tx: Tx, nombre: string | null) {
  const limpio = nombre?.trim();
  if (!limpio) return null;
  const [existente] = await tx.select({ id: aportes.id }).from(aportes).where(eq(aportes.nombre, limpio));
  if (existente) return existente.id;
  const [nuevo] = await tx.insert(aportes).values({ nombre: limpio }).returning({ id: aportes.id });
  return nuevo.id;
}

/**
 * Registra una labor con sus productos, o la reemplaza si viene `laborId` (edición).
 * Los precios quedan guardados como snapshot.
 */
export async function guardarLabor(labor: DatosLabor, laborId?: number): Promise<Resultado> {
  await verificarSesion();

  const error = validar(labor);
  if (error) return { ok: false, error };
  if (laborId !== undefined && !Number.isInteger(laborId)) return { ok: false, error: "Labor inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  const campania = await campaniaActual();
  if (!campania) return { ok: false, error: "No hay una campaña creada." };

  const existe = await dbTx.transaction(async (tx) => {
    const cicloId = await cicloDelLote(tx, labor.loteId, campania.id);
    const aporteId = await aporteDeNombre(tx, labor.aporte);

    const valores = {
      cicloId,
      tipoLaborId: labor.tipoLaborId,
      fecha: labor.fecha,
      superficieHa: String(labor.ha),
      costoLaborPorHa: labor.costoLaborHa === null ? null : String(labor.costoLaborHa),
      monedaLabor: "USD" as const,
      aporteId,
      notas: labor.notas?.trim() || null,
    };

    let id = laborId;
    if (id === undefined) {
      [{ id }] = await tx.insert(labores).values(valores).returning({ id: labores.id });
    } else {
      const actualizadas = await tx.update(labores).set(valores).where(eq(labores.id, id)).returning({ id: labores.id });
      if (!actualizadas.length) return false;
      // Los productos se reemplazan completos: es más simple que comparar línea por línea.
      await tx.delete(laborInsumos).where(eq(laborInsumos.laborId, id));
    }

    if (labor.insumos.length) {
      await tx.insert(laborInsumos).values(
        labor.insumos.map((i) => ({
          laborId: id!,
          productoId: i.productoId,
          dosisPorHa: String(i.dosis),
          cantidadTotal: String(i.dosis * labor.ha),
          precioUnitario: String(i.precio),
          moneda: "USD" as const,
        })),
      );
    }
    return true;
  });

  if (!existe) return { ok: false, error: "La labor ya no existe (¿se eliminó?)." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Borra una labor y sus productos (labor_insumos se borra en cascada). */
export async function eliminarLabor(id: number): Promise<Resultado> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Labor inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  await db.delete(labores).where(eq(labores.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
