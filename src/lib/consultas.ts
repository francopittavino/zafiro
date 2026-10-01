import "server-only";
import { costoLabor, margenBruto } from "./calculos";
import { obtenerDatos, type Datos, type Labor } from "./datos";

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

export async function laboresDetalladas(filtro?: { loteId?: number }) {
  const datos = await obtenerDatos();
  return datos.labores
    .filter((l) => !filtro?.loteId || l.loteId === filtro.loteId)
    .map((l) => detallar(datos, l));
}

/** Costos del ciclo de un lote separados como en el informe de margen bruto. */
export function costosDelCiclo(labores: LaborDetalle[]) {
  let insumos = 0;
  let trabajos = 0;
  let cosecha = 0;
  for (const l of labores) {
    insumos += l.costo.insumos;
    if (l.categoria === "cosecha") cosecha += l.costo.trabajo;
    else trabajos += l.costo.trabajo;
  }
  return { insumos, labores: trabajos, cosecha, total: insumos + trabajos + cosecha };
}

/** Totales de la campaña por campo (solo lotes con labores). */
export async function resumenPorCampo() {
  const datos = await obtenerDatos();
  const labores = await laboresDetalladas();
  return datos.campos
    .map((campo) => {
      const lotes = datos.lotes.filter((l) => l.campoId === campo.id);
      const conLabores = lotes.filter((l) => labores.some((x) => x.loteId === l.id));
      const ha = conLabores.reduce((t, l) => t + l.ha, 0);
      const total = labores
        .filter((x) => lotes.some((l) => l.id === x.loteId))
        .reduce((t, x) => t + x.costo.total, 0);
      return { ...campo, haTotal: lotes.reduce((t, l) => t + l.ha, 0), ha, total, usdHa: ha ? total / ha : 0 };
    })
    .sort((a, b) => b.usdHa - a.usdHa);
}

export async function margenDelLote(loteId: number) {
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === loteId);
  const cosecha = datos.cosechas.find((c) => c.loteId === loteId);
  if (!lote || !cosecha) return null;
  const costos = costosDelCiclo(await laboresDetalladas({ loteId }));
  return { lote, cosecha, costos, resultado: margenBruto(lote.ha, cosecha, costos) };
}
