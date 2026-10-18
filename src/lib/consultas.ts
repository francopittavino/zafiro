import "server-only";
import { costoLabor, margenBruto } from "./calculos";
import { obtenerDatos, type Datos, type Gasto, type Labor, type Lote } from "./datos";

/** Labor con los nombres resueltos y sus costos, lista para mostrar. */
export type LaborDetalle = Labor & {
  lote: { codigo: string; nombre: string; cultivo: string };
  campo: string;
  tipo: string;
  categoria: string;
  productos: { nombre: string; unidad: string; dosis: number; precio: number }[];
  costo: { insumos: number; trabajo: number; total: number };
};

function detallar(datos: Datos, labor: Labor): LaborDetalle {
  const lote = datos.lotes.find((l) => l.id === labor.loteId)!;
  const tipo = datos.tiposLabor.find((t) => t.id === labor.tipoLaborId);
  return {
    ...labor,
    lote: { codigo: lote.codigo, nombre: lote.nombre, cultivo: lote.cultivo },
    campo: datos.campos.find((c) => c.id === lote.campoId)?.nombre ?? "",
    // Filas de la planilla con productos pero sin labor: se aplicaron sin costo de labor cargado.
    tipo: tipo?.nombre ?? "Aplicación de insumos",
    categoria: tipo?.categoria ?? "otra",
    productos: labor.insumos.map((i) => {
      const p = datos.productos.find((x) => x.id === i.productoId)!;
      return { nombre: p.nombre, unidad: p.unidad, dosis: i.dosis, precio: i.precio };
    }),
    costo: costoLabor(labor),
  };
}

/** Labores con sus costos; `datos` permite usar otro alcance (una campaña o un ciclo cerrado). */
export async function laboresDetalladas(filtro?: { loteId?: number }, datos?: Datos) {
  datos ??= await obtenerDatos();
  return datos.labores
    .filter((l) => !filtro?.loteId || l.loteId === filtro.loteId)
    .map((l) => detallar(datos, l));
}

/**
 * Otros gastos que le tocan a un lote: los cargados al lote y su parte (por hectárea)
 * de los cargados al campo entero. Los generales de la campaña no se reparten.
 */
export function otrosGastosDelLote(datos: Datos, lote: Lote) {
  const haCampo = datos.lotes.filter((l) => l.campoId === lote.campoId).reduce((t, l) => t + l.ha, 0);
  const parte = haCampo ? lote.ha / haCampo : 0;
  const propios: (Gasto & { prorrateado: boolean })[] = [];
  let total = 0;
  for (const g of datos.gastos ?? []) {
    if (g.loteId === lote.id) {
      propios.push({ ...g, prorrateado: false });
      total += g.importe;
    } else if (g.campoId === lote.campoId) {
      propios.push({ ...g, importe: g.importe * parte, prorrateado: true });
      total += g.importe * parte;
    }
  }
  return { gastos: propios, total };
}

/** Costos del ciclo de un lote separados como en el informe de margen bruto. */
export function costosDelCiclo(labores: LaborDetalle[], otros = 0) {
  let insumos = 0;
  let trabajos = 0;
  let cosecha = 0;
  for (const l of labores) {
    insumos += l.costo.insumos;
    if (l.categoria === "cosecha") cosecha += l.costo.trabajo;
    else trabajos += l.costo.trabajo;
  }
  return { insumos, labores: trabajos, cosecha, otros, total: insumos + trabajos + cosecha + otros };
}

/** Una fila por lote con todo lo necesario para agrupar y filtrar los informes. */
export type CostoLote = {
  lote: Lote;
  campo: string;
  campoId: number;
  productor: string;
  productorId: number | null;
  costos: ReturnType<typeof costosDelCiclo>;
  conMovimientos: boolean;
};

export async function costosPorLote(datos?: Datos): Promise<CostoLote[]> {
  datos ??= await obtenerDatos();
  const labores = await laboresDetalladas(undefined, datos);
  const d = datos;
  return d.lotes.map((lote) => {
    const campo = d.campos.find((c) => c.id === lote.campoId);
    const productor = d.productores?.find((p) => p.id === campo?.productorId);
    const delLote = labores.filter((l) => l.loteId === lote.id);
    const otros = otrosGastosDelLote(d, lote).total;
    return {
      lote,
      campo: campo?.nombre ?? "",
      campoId: lote.campoId,
      productor: productor?.nombre ?? "Sin productor",
      productorId: productor?.id ?? null,
      costos: costosDelCiclo(delLote, otros),
      conMovimientos: delLote.length > 0 || otros > 0,
    };
  });
}

/** Totales de la campaña por campo (las ha cuentan solo los lotes con labores o gastos). */
export async function resumenPorCampo() {
  const datos = await obtenerDatos();
  const filas = await costosPorLote();
  return datos.campos
    .map((campo) => {
      const delCampo = filas.filter((f) => f.campoId === campo.id);
      const conCostos = delCampo.filter((f) => f.conMovimientos);
      const ha = conCostos.reduce((t, f) => t + f.lote.ha, 0);
      const total = delCampo.reduce((t, f) => t + f.costos.total, 0);
      return {
        ...campo,
        haTotal: delCampo.reduce((t, f) => t + f.lote.ha, 0),
        ha,
        total,
        usdHa: ha ? total / ha : 0,
      };
    })
    .sort((a, b) => b.usdHa - a.usdHa);
}

export async function margenDelLote(loteId: number) {
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === loteId);
  const cosecha = datos.cosechas.find((c) => c.loteId === loteId);
  if (!lote || !cosecha) return null;
  const costos = costosDelCiclo(await laboresDetalladas({ loteId }), otrosGastosDelLote(datos, lote).total);
  return { lote, cosecha, costos, resultado: margenBruto(lote.ha, cosecha, costos) };
}
