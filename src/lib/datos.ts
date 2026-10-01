import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  aportes,
  campanias,
  campos,
  ciclos,
  cotizaciones,
  laborInsumos,
  labores,
  lotes,
  preciosProducto,
  productos,
  tiposLabor,
} from "@/db/schema";
import { modoDemo } from "./modo-demo";

/**
 * Datos de la campaña actual, ya convertidos a números para las pantallas.
 * Salen de la base; en modo demo, de `datos-demo/zafiro.json` (ver scripts/importar-planilla.py).
 */

export type Categoria =
  | "herbicida"
  | "insecticida"
  | "fungicida"
  | "fertilizante"
  | "semilla"
  | "coadyuvante"
  | "otro"
  | "fertilizante_foliar"
  | "inoculante"
  | "curasemilla";

export type Unidad = "L" | "kg" | "u" | "tn" | "bolsa" | "pack" | "dosis";
export type CategoriaLabor =
  | "siembra"
  | "pulverizacion"
  | "fertilizacion"
  | "cosecha"
  | "laboreo"
  | "otra";

export type Campo = { id: number; nombre: string };
export type Lote = {
  id: number;
  campoId: number;
  codigo: string;
  nombre: string;
  ha: number;
  cultivo: string;
};
export type Producto = {
  id: number;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  precio: number;
};
export type TipoLabor = {
  id: number;
  nombre: string;
  categoria: CategoriaLabor;
  cotizacion: "litros_gasoil" | "usd_fijo";
  litrosGasoilHa: number | null;
  costoUsdHa: number | null;
};
export type InsumoAplicado = { productoId: number; dosis: number; precio: number };
export type Labor = {
  id: number;
  loteId: number;
  fecha: string;
  tipoLaborId: number | null;
  ha: number;
  costoLaborHa: number;
  aporte: string | null;
  notas?: string | null;
  insumos: InsumoAplicado[];
};
export type Cosecha = {
  loteId: number;
  fecha: string;
  rindeKgHa: number;
  arrendamientoPorcentaje: number | null;
  precioPizarra: number;
  gastosComercializacionPorcentaje: number;
  fleteUsdTn: number;
};
export type Datos = {
  campania: string;
  cotizacion: { tipoCambio: number; precioGasoil: number };
  campos: Campo[];
  lotes: Lote[];
  productos: Producto[];
  tiposLabor: TipoLabor[];
  aportes: string[];
  labores: Labor[];
  cosechas: Cosecha[];
};

const VACIO: Datos = {
  campania: "2024/25",
  cotizacion: { tipoCambio: 1, precioGasoil: 0 },
  campos: [],
  lotes: [],
  productos: [],
  tiposLabor: [],
  aportes: [],
  labores: [],
  cosechas: [],
};

async function datosDemo(): Promise<Datos> {
  try {
    const archivo = path.join(process.cwd(), "datos-demo", "zafiro.json");
    return JSON.parse(await readFile(archivo, "utf-8")) as Datos;
  } catch {
    return VACIO;
  }
}

const n = (valor: string | null) => (valor === null ? null : Number(valor));

/** Campaña con la que trabaja la app: por ahora, la más reciente. */
export const campaniaActual = cache(async () => {
  const [campania] = await db.select().from(campanias).orderBy(desc(campanias.nombre)).limit(1);
  return campania ?? null;
});

async function datosDeLaBase(): Promise<Datos> {
  const campania = await campaniaActual();
  if (!campania) return VACIO;

  const [
    filasCampos,
    filasLotes,
    filasCiclos,
    filasProductos,
    filasPrecios,
    filasTipos,
    filasAportes,
    [cotizacion],
    filasLabores,
    filasInsumos,
  ] = await Promise.all([
    db.select().from(campos).orderBy(campos.nombre),
    db.select().from(lotes).where(eq(lotes.activo, true)).orderBy(lotes.codigo),
    db.select().from(ciclos).where(eq(ciclos.campaniaId, campania.id)),
    db.select().from(productos).where(eq(productos.activo, true)).orderBy(productos.nombreComercial),
    // Precio vigente: el de fecha más reciente de cada producto.
    db
      .selectDistinctOn([preciosProducto.productoId], {
        productoId: preciosProducto.productoId,
        precio: preciosProducto.precioUnitario,
      })
      .from(preciosProducto)
      .orderBy(preciosProducto.productoId, desc(preciosProducto.fecha), desc(preciosProducto.id)),
    db.select().from(tiposLabor).where(eq(tiposLabor.activo, true)).orderBy(tiposLabor.id),
    db.select().from(aportes).where(eq(aportes.activo, true)).orderBy(aportes.id),
    db.select().from(cotizaciones).orderBy(desc(cotizaciones.fecha)).limit(1),
    db
      .select({ labor: labores, loteId: ciclos.loteId, aporte: aportes.nombre })
      .from(labores)
      .innerJoin(ciclos, eq(labores.cicloId, ciclos.id))
      .leftJoin(aportes, eq(labores.aporteId, aportes.id))
      .where(eq(ciclos.campaniaId, campania.id))
      .orderBy(desc(labores.fecha), desc(labores.id)),
    db
      .select({
        laborId: laborInsumos.laborId,
        productoId: laborInsumos.productoId,
        dosis: laborInsumos.dosisPorHa,
        precio: laborInsumos.precioUnitario,
      })
      .from(laborInsumos)
      .innerJoin(labores, eq(laborInsumos.laborId, labores.id))
      .innerJoin(ciclos, eq(labores.cicloId, ciclos.id))
      .where(eq(ciclos.campaniaId, campania.id))
      .orderBy(laborInsumos.id),
  ]);

  const precios = new Map(filasPrecios.map((p) => [p.productoId, Number(p.precio)]));
  // Cuando haya fina y gruesa en el mismo lote, se muestran los dos cultivos juntos.
  const cultivoDeLote = (loteId: number) =>
    filasCiclos
      .filter((c) => c.loteId === loteId)
      .map((c) => c.cultivo)
      .join("/");

  return {
    campania: campania.nombre,
    cotizacion: {
      tipoCambio: cotizacion ? Number(cotizacion.tipoCambio) : 1,
      precioGasoil: cotizacion ? Number(cotizacion.precioGasoil) : 0,
    },
    campos: filasCampos.map((c) => ({ id: c.id, nombre: c.nombre })),
    lotes: filasLotes.map((l) => ({
      id: l.id,
      campoId: l.campoId,
      codigo: l.codigo ?? "",
      nombre: l.nombre,
      ha: Number(l.superficieHa),
      cultivo: cultivoDeLote(l.id),
    })),
    productos: filasProductos.map((p) => ({
      id: p.id,
      nombre: p.nombreComercial,
      categoria: p.categoria,
      unidad: p.unidad,
      precio: precios.get(p.id) ?? 0,
    })),
    tiposLabor: filasTipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      categoria: t.categoria,
      cotizacion: t.cotizacion,
      litrosGasoilHa: n(t.litrosGasoilHa),
      costoUsdHa: n(t.costoUsdHa),
    })),
    aportes: filasAportes.map((a) => a.nombre),
    labores: filasLabores.map(({ labor, loteId, aporte }) => ({
      id: labor.id,
      loteId,
      fecha: labor.fecha,
      tipoLaborId: labor.tipoLaborId,
      ha: Number(labor.superficieHa),
      costoLaborHa: Number(labor.costoLaborPorHa ?? 0),
      aporte,
      notas: labor.notas,
      insumos: filasInsumos
        .filter((i) => i.laborId === labor.id)
        .map((i) => ({ productoId: i.productoId, dosis: Number(i.dosis), precio: Number(i.precio) })),
    })),
    cosechas: filasCiclos
      .filter((c) => c.rindeKgHa !== null && c.precioPizarra !== null)
      .map((c) => ({
        loteId: c.loteId,
        fecha: c.fechaCosecha ?? "",
        rindeKgHa: Number(c.rindeKgHa),
        arrendamientoPorcentaje: n(c.arrendamientoPorcentaje),
        precioPizarra: Number(c.precioPizarra),
        gastosComercializacionPorcentaje: Number(c.gastosComercializacionPorcentaje ?? 0),
        fleteUsdTn: Number(c.fleteUsdTn ?? 0),
      })),
  };
}

export const obtenerDatos = cache(async (): Promise<Datos> =>
  modoDemo() ? datosDemo() : datosDeLaBase(),
);

export type PrecioHistorico = { fecha: string | null; precio: number };

/** Historial de precios de cada producto, del más nuevo al más viejo. */
export async function historialPrecios(): Promise<Record<number, PrecioHistorico[]>> {
  if (modoDemo()) {
    const { productos: lista } = await datosDemo();
    return Object.fromEntries(lista.map((p) => [p.id, [{ fecha: null, precio: p.precio }]]));
  }
  const filas = await db
    .select({ productoId: preciosProducto.productoId, fecha: preciosProducto.fecha, precio: preciosProducto.precioUnitario })
    .from(preciosProducto)
    .orderBy(desc(preciosProducto.fecha), desc(preciosProducto.id));

  const historial: Record<number, PrecioHistorico[]> = {};
  for (const f of filas) (historial[f.productoId] ??= []).push({ fecha: f.fecha, precio: Number(f.precio) });
  return historial;
}
