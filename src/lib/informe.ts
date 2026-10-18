import "server-only";
import { margenBruto } from "./calculos";
import { costosPorLote, laboresDetalladas, otrosGastosDelLote, type CostoLote } from "./consultas";
import { obtenerDatos } from "./datos";
import { listarRecetas } from "./recetas";

/** Qué entra en el informe (todo opcional: sin filtros es la campaña completa). */
export type FiltroInforme = {
  productor?: number;
  campo?: number;
  lote?: number;
  cultivo?: string;
};

export type Agrupacion = "productor" | "campo" | "cultivo" | "lote";

/** Lee los filtros de los searchParams (página y PDF usan los mismos). */
export function leerFiltro(sp: Record<string, string | string[] | undefined>): FiltroInforme {
  const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);
  return {
    productor: entero(sp.productor),
    campo: entero(sp.campo),
    lote: entero(sp.lote),
    cultivo: typeof sp.cultivo === "string" && sp.cultivo ? sp.cultivo : undefined,
  };
}

export const consultaFiltro = (f: FiltroInforme) =>
  new URLSearchParams(
    Object.entries(f)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

const vacio = () => ({ ha: 0, insumos: 0, labores: 0, cosecha: 0, otros: 0, total: 0 });

export async function armarInforme(filtro: FiltroInforme) {
  const datos = await obtenerDatos();
  const todas = await costosPorLote();
  const filas = todas.filter(
    (f) =>
      (!filtro.productor || f.productorId === filtro.productor) &&
      (!filtro.campo || f.campoId === filtro.campo) &&
      (!filtro.lote || f.lote.id === filtro.lote) &&
      (!filtro.cultivo || f.lote.cultivo.split("/").includes(filtro.cultivo)),
  );
  const ids = new Set(filas.map((f) => f.lote.id));
  const labores = (await laboresDetalladas()).filter((l) => ids.has(l.loteId));
  const recetas = (await listarRecetas()).filter((r) => ids.has(r.loteId));

  const totales = vacio();
  for (const f of filas) {
    if (f.conMovimientos) totales.ha += f.lote.ha;
    totales.insumos += f.costos.insumos;
    totales.labores += f.costos.labores;
    totales.cosecha += f.costos.cosecha;
    totales.otros += f.costos.otros;
    totales.total += f.costos.total;
  }

  /** Suma las filas por la clave elegida (ej. por cultivo). */
  function agrupar(por: Agrupacion) {
    const grupos = new Map<string, ReturnType<typeof vacio> & { nombre: string; lotes: number }>();
    for (const f of filas) {
      const claves =
        por === "productor"
          ? [f.productor]
          : por === "campo"
            ? [f.campo]
            : por === "lote"
              ? [`${f.campo} · ${f.lote.codigo} ${f.lote.nombre}`.trim()]
              : [f.lote.cultivo || "Sin cultivo"];
      for (const clave of claves) {
        const g = grupos.get(clave) ?? { ...vacio(), nombre: clave, lotes: 0 };
        g.lotes += 1;
        if (f.conMovimientos) g.ha += f.lote.ha;
        g.insumos += f.costos.insumos;
        g.labores += f.costos.labores;
        g.cosecha += f.costos.cosecha;
        g.otros += f.costos.otros;
        g.total += f.costos.total;
        grupos.set(clave, g);
      }
    }
    return [...grupos.values()].sort((a, b) => b.total - a.total);
  }

  // Consumo de insumos (cantidades totales y costo), útil para compras y para el productor.
  const consumo = new Map<string, { nombre: string; unidad: string; categoria: string; cantidad: number; costo: number }>();
  for (const l of labores) {
    for (const i of l.insumos) {
      const p = datos.productos.find((x) => x.id === i.productoId);
      if (!p) continue;
      const fila = consumo.get(p.nombre) ?? { nombre: p.nombre, unidad: p.unidad, categoria: p.categoria, cantidad: 0, costo: 0 };
      fila.cantidad += i.dosis * l.ha;
      fila.costo += i.dosis * i.precio * l.ha;
      consumo.set(p.nombre, fila);
    }
  }

  const margenes = filas.flatMap((f: CostoLote) => {
    const cosecha = datos.cosechas.find((c) => c.loteId === f.lote.id);
    return cosecha ? [{ fila: f, cosecha, resultado: margenBruto(f.lote.ha, cosecha, f.costos) }] : [];
  });

  const gastos = filas.flatMap((f) =>
    otrosGastosDelLote(datos, f.lote).gastos.map((g) => ({ ...g, lote: f.lote, campo: f.campo })),
  );

  // Título según lo filtrado.
  const productor = datos.productores?.find((p) => p.id === filtro.productor);
  const campo = datos.campos.find((c) => c.id === filtro.campo);
  const lote = datos.lotes.find((l) => l.id === filtro.lote);
  const partes = [
    productor?.nombre,
    campo?.nombre,
    lote && `Lote ${lote.codigo} ${lote.nombre}`.trim(),
    filtro.cultivo,
  ].filter(Boolean);

  return {
    datos,
    filtro,
    titulo: partes.length ? partes.join(" · ") : "Todos los campos",
    filas,
    labores,
    recetas,
    totales,
    agrupar,
    consumo: [...consumo.values()].sort((a, b) => b.costo - a.costo),
    margenes,
    gastos,
    productor,
    campo,
    lote,
  };
}
