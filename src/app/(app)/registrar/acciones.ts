"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import {
  aportes,
  contratistas,
  laborInsumos,
  labores,
  lotes,
  movimientosStock,
  type Dibujo,
} from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import type { DatosAplicacion } from "@/lib/datos";
import { limpiarExtras } from "@/lib/extras";
import { dibujoValido } from "@/lib/dibujo";
import { SIN_CULTIVO, cicloParaRegistro, type Tx } from "@/lib/ciclos";
import { modoDemo } from "@/lib/modo-demo";

export type DatosLabor = {
  loteId: number;
  fecha: string;
  tipoLaborId: number;
  ha: number;
  modalidad: "propia" | "contratista" | null;
  contratista: string | null;
  cobro: "ha" | "hora";
  costoLaborHa: number | null;
  horas: number | null;
  costoHora: number | null;
  aporte: string | null;
  notas: string | null;
  aplicacion: DatosAplicacion;
  /** Manchones marcados sobre la foto del campo (si no se aplicó en todo el lote). */
  zonas: Dibujo[] | null;
  /** Receta con la que se hizo la aplicación (opcional). */
  recetaId: number | null;
  extras: Record<string, string>;
  insumos: { productoId: number; dosis: number; precio: number }[];
  /** Descontar los productos del stock del campo. */
  descontarStock: boolean;
};

export type Resultado = { ok: true; id?: number; demo?: boolean } | { ok: false; error: string };

const positivo = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
const noNegativo = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const opcionalValido = (n: unknown) => n === null || (typeof n === "number" && Number.isFinite(n));
const numero = (n: number | null) => (n === null ? null : String(n));
const texto = (t: string | null) => t?.trim() || null;

/** Validación en el servidor: lo que llega del navegador no es confiable. */
function validar(labor: DatosLabor): string | null {
  if (!Number.isInteger(labor.loteId) || !Number.isInteger(labor.tipoLaborId)) return "Falta el lote o la labor.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(labor.fecha)) return "La fecha no es válida.";
  if (!positivo(labor.ha)) return "Las hectáreas tienen que ser mayores a 0.";
  if (labor.modalidad !== null && labor.modalidad !== "propia" && labor.modalidad !== "contratista")
    return "La modalidad no es válida.";
  if (labor.cobro !== "ha" && labor.cobro !== "hora") return "Elegí si se cobra por ha o por hora.";
  if (labor.costoLaborHa !== null && !noNegativo(labor.costoLaborHa)) return "El costo de la labor no es válido.";
  if (labor.horas !== null && !noNegativo(labor.horas)) return "Las horas no son válidas.";
  if (labor.costoHora !== null && !noNegativo(labor.costoHora)) return "El costo por hora no es válido.";
  const a = labor.aplicacion;
  if (!a || ![a.caudalLHa, a.temperatura, a.humedad, a.vientoKmH].every(opcionalValido))
    return "Revisá los datos de la aplicación.";
  if (labor.zonas !== null && !(Array.isArray(labor.zonas) && labor.zonas.length <= 50 && labor.zonas.every(dibujoValido)))
    return "Las zonas marcadas no son válidas.";
  if (labor.recetaId !== null && !Number.isInteger(labor.recetaId)) return "La receta no es válida.";
  if (!labor.insumos.every((i) => Number.isInteger(i.productoId) && positivo(i.dosis) && noNegativo(i.precio)))
    return "Revisá la dosis y el precio de los productos.";
  return null;
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

/** Igual que el aporte: el contratista se elige o se escribe uno nuevo. */
async function contratistaDeNombre(tx: Tx, nombre: string | null) {
  const limpio = nombre?.trim();
  if (!limpio) return null;
  const [existente] = await tx
    .select({ id: contratistas.id })
    .from(contratistas)
    .where(eq(contratistas.nombre, limpio))
    .limit(1);
  if (existente) return existente.id;
  const [nuevo] = await tx.insert(contratistas).values({ nombre: limpio }).returning({ id: contratistas.id });
  return nuevo.id;
}

/**
 * Registra una labor con sus productos, o la reemplaza si viene `laborId` (edición).
 * Los precios quedan guardados como snapshot. Si se pide, descuenta los productos del
 * stock del campo (al editar, los movimientos de la labor se rehacen).
 */
export async function guardarLabor(labor: DatosLabor, laborId?: number): Promise<Resultado> {
  await verificarSesion();

  const error = validar(labor);
  if (error) return { ok: false, error };
  if (laborId !== undefined && !Number.isInteger(laborId)) return { ok: false, error: "Labor inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  const anterior =
    laborId === undefined
      ? undefined
      : (await db.select({ cicloId: labores.cicloId }).from(labores).where(eq(labores.id, laborId)))[0]?.cicloId;
  const ciclo = await cicloParaRegistro(db, labor.loteId, anterior);
  if (!ciclo) return { ok: false, error: SIN_CULTIVO };
  const extras = await limpiarExtras("labor", labor.extras);

  const guardada = await dbTx.transaction(async (tx) => {
    const cicloId = ciclo.id;
    const [{ campoId }] = await tx.select({ campoId: lotes.campoId }).from(lotes).where(eq(lotes.id, labor.loteId));
    const aporteId = await aporteDeNombre(tx, labor.aporte);
    const contratistaId = labor.modalidad === "contratista" ? await contratistaDeNombre(tx, labor.contratista) : null;
    const a = labor.aplicacion;

    const valores = {
      cicloId,
      tipoLaborId: labor.tipoLaborId,
      fecha: labor.fecha,
      superficieHa: String(labor.ha),
      modalidad: labor.modalidad,
      contratistaId,
      cobro: labor.cobro,
      costoLaborPorHa: labor.cobro === "ha" ? numero(labor.costoLaborHa) : null,
      horas: labor.cobro === "hora" ? numero(labor.horas) : null,
      costoHora: labor.cobro === "hora" ? numero(labor.costoHora) : null,
      monedaLabor: "USD" as const,
      aporteId,
      caudalLHa: numero(a.caudalLHa),
      temperatura: numero(a.temperatura),
      humedad: numero(a.humedad),
      vientoKmH: numero(a.vientoKmH),
      vientoDireccion: texto(a.vientoDireccion),
      aplicador: texto(a.aplicador),
      zonas: labor.zonas?.length ? labor.zonas : null,
      recetaId: labor.recetaId,
      extras,
      notas: texto(labor.notas),
    };

    let id = laborId;
    if (id === undefined) {
      [{ id }] = await tx.insert(labores).values(valores).returning({ id: labores.id });
    } else {
      const actualizadas = await tx.update(labores).set(valores).where(eq(labores.id, id)).returning({ id: labores.id });
      if (!actualizadas.length) return null;
      // Los productos y su stock se reemplazan completos: es más simple que comparar línea por línea.
      await tx.delete(laborInsumos).where(eq(laborInsumos.laborId, id));
      await tx.delete(movimientosStock).where(eq(movimientosStock.laborId, id));
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
      if (labor.descontarStock) {
        await tx.insert(movimientosStock).values(
          labor.insumos.map((i) => ({
            campoId,
            productoId: i.productoId,
            fecha: labor.fecha,
            tipo: "aplicacion" as const,
            cantidad: String(-i.dosis * labor.ha),
            laborId: id!,
          })),
        );
      }
    }
    return id;
  });

  if (guardada === null) return { ok: false, error: "La labor ya no existe (¿se eliminó?)." };
  revalidatePath("/", "layout");
  return { ok: true, id: guardada };
}

/** Borra una labor con sus productos y sus movimientos de stock (en cascada): el stock vuelve. */
export async function eliminarLabor(id: number): Promise<Resultado> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Labor inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  await db.delete(labores).where(eq(labores.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
