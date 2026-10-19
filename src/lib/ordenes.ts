import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ciclos, contratistas, ordenGastos, ordenItems, ordenesTrabajo } from "@/db/schema";
import { obtenerDatos } from "./datos";
import { modoDemo } from "./modo-demo";
import { recetaDetallada } from "./recetas";

export type EstadoOrden = "pendiente" | "enviada" | "realizada" | "anulada";

export type Orden = {
  id: number;
  numero: number;
  fecha: string;
  loteId: number;
  cicloId: number;
  recetaId: number | null;
  tipoLaborId: number | null;
  fechaPrevista: string | null;
  ha: number;
  modalidad: "propia" | "contratista" | null;
  contratista: string | null;
  cobro: "ha" | "hora";
  costoLaborHa: number | null;
  horas: number | null;
  costoHora: number | null;
  instrucciones: string | null;
  observaciones: string | null;
  mostrarCostos: boolean;
  estado: EstadoOrden;
  laborId: number | null;
  items: { productoId: number; dosis: number; precio: number }[];
  gastos: { concepto: string; importe: number }[];
};

const n = (v: string | null) => (v === null ? null : Number(v));

/** Órdenes de trabajo (de todas las campañas), de la más nueva a la más vieja. */
export async function listarOrdenes(filtro?: { id?: number }): Promise<Orden[]> {
  if (modoDemo()) return [];
  const filas = await db
    .select({ orden: ordenesTrabajo, loteId: ciclos.loteId, contratista: contratistas.nombre })
    .from(ordenesTrabajo)
    .innerJoin(ciclos, eq(ordenesTrabajo.cicloId, ciclos.id))
    .leftJoin(contratistas, eq(ordenesTrabajo.contratistaId, contratistas.id))
    .where(filtro?.id !== undefined ? eq(ordenesTrabajo.id, filtro.id) : undefined)
    .orderBy(desc(ordenesTrabajo.numero));
  if (!filas.length) return [];

  const ids = filas.map((f) => f.orden.id);
  const [items, gastos] = await Promise.all([
    db.select().from(ordenItems).where(inArray(ordenItems.ordenId, ids)).orderBy(ordenItems.id),
    db.select().from(ordenGastos).where(inArray(ordenGastos.ordenId, ids)).orderBy(ordenGastos.id),
  ]);

  return filas.map(({ orden: o, loteId, contratista }) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.fecha,
    loteId,
    cicloId: o.cicloId,
    recetaId: o.recetaId,
    tipoLaborId: o.tipoLaborId,
    fechaPrevista: o.fechaPrevista,
    ha: Number(o.superficieHa),
    modalidad: o.modalidad,
    contratista,
    cobro: o.cobro,
    costoLaborHa: n(o.costoLaborPorHa),
    horas: n(o.horas),
    costoHora: n(o.costoHora),
    instrucciones: o.instrucciones,
    observaciones: o.observaciones,
    mostrarCostos: o.mostrarCostos,
    estado: o.estado,
    laborId: o.laborId,
    items: items
      .filter((i) => i.ordenId === o.id)
      .map((i) => ({ productoId: i.productoId, dosis: Number(i.dosisPorHa), precio: Number(i.precioUnitario) })),
    gastos: gastos.filter((g) => g.ordenId === o.id).map((g) => ({ concepto: g.concepto, importe: Number(g.importe) })),
  }));
}

export async function ordenPorId(id: number) {
  const [orden] = await listarOrdenes({ id });
  return orden ?? null;
}

/** Costos estimados de la orden: insumos (dosis × precio × ha) + labor (por ha o por hora) + otros gastos. */
export function costosDeOrden(o: Pick<Orden, "ha" | "items" | "gastos" | "cobro" | "costoLaborHa" | "horas" | "costoHora">) {
  const insumos = o.items.reduce((t, i) => t + i.dosis * i.precio * o.ha, 0);
  const trabajo = o.cobro === "hora" ? (o.horas ?? 0) * (o.costoHora ?? 0) : (o.costoLaborHa ?? 0) * o.ha;
  const otros = o.gastos.reduce((t, g) => t + g.importe, 0);
  return { insumos, trabajo, otros, total: insumos + trabajo + otros };
}

/** Orden con lote, campo, productor, labor, productos y receta resueltos, lista para mostrar o imprimir. */
export async function ordenDetallada(id: number) {
  const orden = await ordenPorId(id);
  if (!orden) return null;
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === orden.loteId);
  const campo = datos.campos.find((c) => c.id === lote?.campoId);
  const productor = datos.productores?.find((p) => p.id === campo?.productorId);
  const receta = orden.recetaId ? await recetaDetallada(orden.recetaId) : null;
  return {
    orden,
    lote,
    campo,
    productor,
    receta,
    tipoLabor: datos.tiposLabor.find((t) => t.id === orden.tipoLaborId)?.nombre ?? null,
    costos: costosDeOrden(orden),
    productos: orden.items.map((i) => {
      const p = datos.productos.find((x) => x.id === i.productoId);
      return {
        nombre: p?.nombre ?? "Insumo",
        principioActivo: p?.principioActivo ?? null,
        bandaToxicologica: p?.bandaToxicologica ?? null,
        carenciaDias: p?.carenciaDias ?? null,
        unidad: p?.unidad ?? "",
        dosis: i.dosis,
        total: i.dosis * orden.ha,
        precio: i.precio,
        importe: i.dosis * i.precio * orden.ha,
      };
    }),
  };
}

export type OrdenDetallada = NonNullable<Awaited<ReturnType<typeof ordenDetallada>>>;
