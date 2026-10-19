"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db, dbTx } from "@/db";
import { ciclos, ordenGastos, ordenItems, ordenesTrabajo, recetas } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { SIN_CULTIVO, cicloParaRegistro } from "@/lib/ciclos";
import { contratistaDeNombre } from "@/lib/contratistas";
import { modoDemo } from "@/lib/modo-demo";
import type { EstadoOrden } from "@/lib/ordenes";
import type { ResultadoAlta } from "../acciones-catalogos";

export type DatosOrden = {
  loteId: number;
  fecha: string;
  estado: EstadoOrden;
  recetaId: number | null;
  tipoLaborId: number | null;
  fechaPrevista: string;
  ha: number;
  modalidad: "propia" | "contratista" | null;
  contratista: string | null;
  cobro: "ha" | "hora";
  costoLaborHa: number | null;
  horas: number | null;
  costoHora: number | null;
  instrucciones: string;
  observaciones: string;
  mostrarCostos: boolean;
  items: { productoId: number; dosis: number; precio: number }[];
  gastos: { concepto: string; importe: number }[];
};

const ESTADOS: EstadoOrden[] = ["pendiente", "enviada", "realizada", "anulada"];
const fechaValida = (f: unknown) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
const positivo = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
const noNegativo = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const opcionalNoNegativo = (v: unknown) => v === null || noNegativo(v);
const entero = (v: unknown) => v === null || Number.isInteger(v);
const texto = (t: unknown) => (typeof t === "string" ? t.trim() || null : null);
const numero = (v: number | null) => (v === null ? null : String(v));

/** Validación en el servidor: lo que llega del navegador no es confiable. */
function validar(o: DatosOrden) {
  if (!Number.isInteger(o.loteId)) return "Elegí el lote.";
  if (!fechaValida(o.fecha)) return "La fecha no es válida.";
  if (!ESTADOS.includes(o.estado)) return "El estado no es válido.";
  if (!entero(o.recetaId) || !entero(o.tipoLaborId)) return "Revisá la receta y la labor.";
  if (o.fechaPrevista && !fechaValida(o.fechaPrevista)) return "La fecha prevista no es válida.";
  if (!positivo(o.ha)) return "La superficie tiene que ser mayor a 0.";
  if (o.modalidad !== null && o.modalidad !== "propia" && o.modalidad !== "contratista") return "La modalidad no es válida.";
  if (o.cobro !== "ha" && o.cobro !== "hora") return "Elegí si se cobra por ha o por hora.";
  if (![o.costoLaborHa, o.horas, o.costoHora].every(opcionalNoNegativo)) return "Revisá el costo de la labor.";
  if (!Array.isArray(o.items) || !o.items.every((i) => Number.isInteger(i.productoId) && positivo(i.dosis) && noNegativo(i.precio)))
    return "Revisá la dosis y el precio de los productos.";
  if (!Array.isArray(o.gastos) || !o.gastos.every((g) => texto(g.concepto) && noNegativo(g.importe)))
    return "Revisá los otros gastos (concepto e importe).";
  return null;
}

/** Crea la orden con el número siguiente (correlativo) o la reemplaza si viene `ordenId`. */
export async function guardarOrden(datos: DatosOrden, ordenId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const error = validar(datos);
  if (error) return { ok: false, error };
  if (ordenId !== undefined && !Number.isInteger(ordenId)) return { ok: false, error: "Orden inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  const anterior =
    ordenId === undefined
      ? undefined
      : (await db.select({ cicloId: ordenesTrabajo.cicloId }).from(ordenesTrabajo).where(eq(ordenesTrabajo.id, ordenId)))[0]
          ?.cicloId;
  const ciclo = await cicloParaRegistro(db, datos.loteId, anterior);
  if (!ciclo) return { ok: false, error: SIN_CULTIVO };
  if (datos.recetaId !== null) {
    // La receta tiene que ser del mismo lote.
    const [receta] = await db
      .select({ id: recetas.id })
      .from(recetas)
      .innerJoin(ciclos, eq(recetas.cicloId, ciclos.id))
      .where(and(eq(recetas.id, datos.recetaId), eq(ciclos.loteId, datos.loteId)));
    if (!receta) return { ok: false, error: "La receta no es de este lote." };
  }

  const id = await dbTx.transaction(async (tx) => {
    const valores = {
      cicloId: ciclo.id,
      fecha: datos.fecha,
      estado: datos.estado,
      recetaId: datos.recetaId,
      tipoLaborId: datos.tipoLaborId,
      fechaPrevista: datos.fechaPrevista || null,
      superficieHa: String(datos.ha),
      modalidad: datos.modalidad,
      contratistaId: datos.modalidad === "contratista" ? await contratistaDeNombre(tx, datos.contratista) : null,
      cobro: datos.cobro,
      costoLaborPorHa: datos.cobro === "ha" ? numero(datos.costoLaborHa) : null,
      horas: datos.cobro === "hora" ? numero(datos.horas) : null,
      costoHora: datos.cobro === "hora" ? numero(datos.costoHora) : null,
      instrucciones: texto(datos.instrucciones),
      observaciones: texto(datos.observaciones),
      mostrarCostos: Boolean(datos.mostrarCostos),
    };

    let id = ordenId;
    if (id === undefined) {
      // Con un solo usuario no hay carreras: alcanza con el máximo + 1 dentro de la transacción.
      const [{ ultimo }] = await tx.select({ ultimo: max(ordenesTrabajo.numero) }).from(ordenesTrabajo);
      [{ id }] = await tx
        .insert(ordenesTrabajo)
        .values({ ...valores, numero: (ultimo ?? 0) + 1 })
        .returning({ id: ordenesTrabajo.id });
    } else {
      const actualizadas = await tx
        .update(ordenesTrabajo)
        .set(valores)
        .where(eq(ordenesTrabajo.id, id))
        .returning({ id: ordenesTrabajo.id });
      if (!actualizadas.length) return undefined;
      await tx.delete(ordenItems).where(eq(ordenItems.ordenId, id));
      await tx.delete(ordenGastos).where(eq(ordenGastos.ordenId, id));
    }
    if (datos.items.length)
      await tx.insert(ordenItems).values(
        datos.items.map((i) => ({
          ordenId: id!,
          productoId: i.productoId,
          dosisPorHa: String(i.dosis),
          precioUnitario: String(i.precio),
        })),
      );
    if (datos.gastos.length)
      await tx
        .insert(ordenGastos)
        .values(datos.gastos.map((g) => ({ ordenId: id!, concepto: texto(g.concepto)!, importe: String(g.importe) })));
    return id;
  });

  if (id === undefined) return { ok: false, error: "La orden ya no existe." };
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Cambia solo el estado (ej. "enviada" después de mandarla por WhatsApp). */
export async function cambiarEstadoOrden(id: number, estado: EstadoOrden): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) return { ok: false, error: "Datos inválidos." };
  if (modoDemo()) return { ok: true, demo: true };
  await db.update(ordenesTrabajo).set({ estado }).where(eq(ordenesTrabajo.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Borra la orden con sus productos y gastos (en cascada). La labor registrada, si hay, queda. */
export async function eliminarOrden(id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Orden inválida." };
  if (modoDemo()) return { ok: true, demo: true };
  await db.delete(ordenesTrabajo).where(eq(ordenesTrabajo.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
