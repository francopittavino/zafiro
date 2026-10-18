import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aportes,
  campanias,
  campos,
  camposPersonalizados,
  categoriasGasto,
  ciclos,
  contratistas,
  cotizaciones,
  gastos,
  laborInsumos,
  labores,
  lotes,
  movimientosStock,
  preciosProducto,
  productores,
  productos,
  proveedores,
  tiposLabor,
  type Dibujo,
  type Extras,
} from "@/db/schema";
import { modoDemo } from "./modo-demo";

/**
 * Datos de la campaña actual, ya convertidos a números para las pantallas.
 * Salen de la base; en modo demo, de `datos-demo/zafiro.json` (ver scripts/importar-planilla.py).
 * Los campos opcionales (`?`) no están en el JSON del modo demo.
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
export type EntidadPersonalizable = "campo" | "lote" | "producto" | "labor" | "receta";

export type Productor = {
  id: number;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  localidad: string | null;
  notas: string | null;
};
export type Campo = {
  id: number;
  nombre: string;
  productorId?: number | null;
  localidad?: string | null;
  provincia?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  fotoMapaId?: number | null;
  extras?: Extras | null;
  notas?: string | null;
};
export type Lote = {
  id: number;
  campoId: number;
  codigo: string;
  nombre: string;
  ha: number;
  cultivo: string;
  variedad?: string | null;
  fechaSiembra?: string | null;
  tenencia?: "propio" | "alquilado" | null;
  tipoSuelo?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  dibujo?: Dibujo | null;
  extras?: Extras | null;
  notas?: string | null;
};
export type Producto = {
  id: number;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  precio: number;
  principioActivo?: string | null;
  concentracion?: string | null;
  formulacion?: string | null;
  presentacion?: string | null;
  bandaToxicologica?: string | null;
  carenciaDias?: number | null;
  extras?: Extras | null;
  notas?: string | null;
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
export type DatosAplicacion = {
  caudalLHa: number | null;
  temperatura: number | null;
  humedad: number | null;
  vientoKmH: number | null;
  vientoDireccion: string | null;
  aplicador: string | null;
};
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
  modalidad?: "propia" | "contratista" | null;
  contratista?: string | null;
  cobro?: "ha" | "hora";
  horas?: number | null;
  costoHora?: number | null;
  aplicacion?: DatosAplicacion;
  zonas?: Dibujo[] | null;
  /** Receta con la que se hizo (opcional). */
  recetaId?: number | null;
  extras?: Extras | null;
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
/** Gasto que no es labor ni insumo: de un lote, de un campo entero o general de la campaña. */
export type Gasto = {
  id: number;
  loteId: number | null;
  campoId: number | null;
  categoriaId: number;
  categoria: string;
  fecha: string;
  descripcion: string | null;
  importe: number;
};
export type CampoPersonalizado = {
  id: number;
  entidad: EntidadPersonalizable;
  nombre: string;
  tipo: "texto" | "numero" | "fecha";
};
export type Catalogo = { id: number; nombre: string };
/** Existencia de un insumo en un campo (suma de movimientos). */
export type Existencia = { campoId: number; productoId: number; cantidad: number };

export type Datos = {
  campania: string;
  cotizacion: { tipoCambio: number; precioGasoil: number };
  productores?: Productor[];
  campos: Campo[];
  lotes: Lote[];
  productos: Producto[];
  tiposLabor: TipoLabor[];
  aportes: string[];
  /** Los mismos aportes con su id (para editarlos en Ajustes). */
  listaAportes?: Catalogo[];
  contratistas?: Catalogo[];
  proveedores?: Catalogo[];
  categoriasGasto?: Catalogo[];
  camposPersonalizados?: CampoPersonalizado[];
  labores: Labor[];
  cosechas: Cosecha[];
  gastos?: Gasto[];
  stock?: Existencia[];
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
    filasProductores,
    filasCampos,
    filasLotes,
    filasCiclos,
    filasProductos,
    filasPrecios,
    filasTipos,
    filasAportes,
    filasContratistas,
    filasProveedores,
    filasCategorias,
    filasPersonalizados,
    [cotizacion],
    filasLabores,
    filasInsumos,
    filasGastos,
    filasStock,
  ] = await Promise.all([
    db.select().from(productores).where(eq(productores.activo, true)).orderBy(productores.nombre),
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
    db.select({ id: contratistas.id, nombre: contratistas.nombre }).from(contratistas).orderBy(contratistas.nombre),
    db.select({ id: proveedores.id, nombre: proveedores.nombre }).from(proveedores).orderBy(proveedores.nombre),
    db
      .select({ id: categoriasGasto.id, nombre: categoriasGasto.nombre })
      .from(categoriasGasto)
      .where(eq(categoriasGasto.activo, true))
      .orderBy(categoriasGasto.id),
    db
      .select()
      .from(camposPersonalizados)
      .where(eq(camposPersonalizados.activo, true))
      .orderBy(camposPersonalizados.orden, camposPersonalizados.id),
    db.select().from(cotizaciones).orderBy(desc(cotizaciones.fecha)).limit(1),
    db
      .select({ labor: labores, loteId: ciclos.loteId, aporte: aportes.nombre, contratista: contratistas.nombre })
      .from(labores)
      .innerJoin(ciclos, eq(labores.cicloId, ciclos.id))
      .leftJoin(aportes, eq(labores.aporteId, aportes.id))
      .leftJoin(contratistas, eq(labores.contratistaId, contratistas.id))
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
    db
      .select({ gasto: gastos, loteId: ciclos.loteId, categoria: categoriasGasto.nombre })
      .from(gastos)
      .innerJoin(categoriasGasto, eq(gastos.categoriaId, categoriasGasto.id))
      .leftJoin(ciclos, eq(gastos.cicloId, ciclos.id))
      .where(eq(gastos.campaniaId, campania.id))
      .orderBy(desc(gastos.fecha), desc(gastos.id)),
    // El stock no depende de la campaña: es lo que hay hoy en cada campo.
    db
      .select({
        campoId: movimientosStock.campoId,
        productoId: movimientosStock.productoId,
        cantidad: sql<string>`sum(${movimientosStock.cantidad})`,
      })
      .from(movimientosStock)
      .groupBy(movimientosStock.campoId, movimientosStock.productoId),
  ]);

  const precios = new Map(filasPrecios.map((p) => [p.productoId, Number(p.precio)]));
  const ciclosDeLote = (loteId: number) => filasCiclos.filter((c) => c.loteId === loteId);

  return {
    campania: campania.nombre,
    cotizacion: {
      tipoCambio: cotizacion ? Number(cotizacion.tipoCambio) : 1,
      precioGasoil: cotizacion ? Number(cotizacion.precioGasoil) : 0,
    },
    productores: filasProductores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cuit: p.cuit,
      telefono: p.telefono,
      email: p.email,
      localidad: p.localidad,
      notas: p.notas,
    })),
    campos: filasCampos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productorId: c.productorId,
      localidad: c.localidad,
      provincia: c.provincia,
      latitud: n(c.latitud),
      longitud: n(c.longitud),
      fotoMapaId: c.fotoMapaId,
      extras: c.extras,
      notas: c.notas,
    })),
    lotes: filasLotes.map((l) => {
      const delLote = ciclosDeLote(l.id);
      return {
        id: l.id,
        campoId: l.campoId,
        codigo: l.codigo ?? "",
        nombre: l.nombre,
        ha: Number(l.superficieHa),
        // Cuando haya fina y gruesa en el mismo lote, se muestran los dos cultivos juntos.
        cultivo: delLote.map((c) => c.cultivo).join("/"),
        variedad: delLote.map((c) => c.variedad).filter(Boolean).join("/") || null,
        fechaSiembra: delLote.find((c) => c.fechaSiembra)?.fechaSiembra ?? null,
        tenencia: l.tenencia,
        tipoSuelo: l.tipoSuelo,
        latitud: n(l.latitud),
        longitud: n(l.longitud),
        dibujo: l.dibujo,
        extras: l.extras,
        notas: l.notas,
      };
    }),
    productos: filasProductos.map((p) => ({
      id: p.id,
      nombre: p.nombreComercial,
      categoria: p.categoria,
      unidad: p.unidad,
      precio: precios.get(p.id) ?? 0,
      principioActivo: p.principioActivo,
      concentracion: p.concentracion,
      formulacion: p.formulacion,
      presentacion: p.presentacion,
      bandaToxicologica: p.bandaToxicologica,
      carenciaDias: p.carenciaDias,
      extras: p.extras,
      notas: p.notas,
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
    listaAportes: filasAportes.map((a) => ({ id: a.id, nombre: a.nombre })),
    contratistas: filasContratistas,
    proveedores: filasProveedores,
    categoriasGasto: filasCategorias,
    camposPersonalizados: filasPersonalizados.map((c) => ({
      id: c.id,
      entidad: c.entidad,
      nombre: c.nombre,
      tipo: c.tipo,
    })),
    labores: filasLabores.map(({ labor, loteId, aporte, contratista }) => ({
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
      modalidad: labor.modalidad,
      contratista,
      cobro: labor.cobro,
      horas: n(labor.horas),
      costoHora: n(labor.costoHora),
      aplicacion: {
        caudalLHa: n(labor.caudalLHa),
        temperatura: n(labor.temperatura),
        humedad: n(labor.humedad),
        vientoKmH: n(labor.vientoKmH),
        vientoDireccion: labor.vientoDireccion,
        aplicador: labor.aplicador,
      },
      zonas: labor.zonas,
      recetaId: labor.recetaId,
      extras: labor.extras,
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
    gastos: filasGastos.map(({ gasto, loteId, categoria }) => ({
      id: gasto.id,
      loteId,
      campoId: gasto.campoId,
      categoriaId: gasto.categoriaId,
      categoria,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      importe: Number(gasto.importeUsd),
    })),
    stock: filasStock.map((s) => ({ campoId: s.campoId, productoId: s.productoId, cantidad: Number(s.cantidad) })),
  };
}

export const obtenerDatos = cache(async (): Promise<Datos> =>
  modoDemo() ? datosDemo() : datosDeLaBase(),
);

export type Movimiento = {
  id: number;
  productoId: number;
  fecha: string;
  tipo: "ingreso" | "aplicacion" | "ajuste";
  cantidad: number;
  laborId: number | null;
  proveedor: string | null;
  nota: string | null;
};

/** Últimos movimientos de stock de un campo, del más nuevo al más viejo. */
export async function movimientosDeCampo(campoId: number, limite = 100): Promise<Movimiento[]> {
  if (modoDemo()) return [];
  const filas = await db
    .select({ m: movimientosStock, proveedor: proveedores.nombre })
    .from(movimientosStock)
    .leftJoin(proveedores, eq(movimientosStock.proveedorId, proveedores.id))
    .where(eq(movimientosStock.campoId, campoId))
    .orderBy(desc(movimientosStock.fecha), desc(movimientosStock.id))
    .limit(limite);
  return filas.map(({ m, proveedor }) => ({
    id: m.id,
    productoId: m.productoId,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: Number(m.cantidad),
    laborId: m.laborId,
    proveedor,
    nota: m.nota,
  }));
}

/** Si la labor descontó sus productos del stock (para respetarlo al editarla). */
export async function laborDescontoStock(laborId: number) {
  if (modoDemo()) return false;
  const [fila] = await db
    .select({ id: movimientosStock.id })
    .from(movimientosStock)
    .where(eq(movimientosStock.laborId, laborId))
    .limit(1);
  return Boolean(fila);
}

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
