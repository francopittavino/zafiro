/**
 * Esquema de datos PRELIMINAR (a validar en la reunión con el cliente).
 * Ver docs/DECISIONES.md, sección "Modelo de dominio".
 *
 * Convenciones:
 * - Montos y dosis en `numeric` (Drizzle los devuelve como string, sin pérdida de precisión).
 * - Cada insumo aplicado guarda el precio del momento (snapshot) para que los
 *   costos históricos no cambien cuando se actualiza la lista de precios.
 * - Ajustado con el Excel anterior del cliente (docs/ANALISIS_EXCEL_ANTERIOR.md).
 */
import {
  pgTable,
  pgEnum,
  integer,
  text,
  numeric,
  date,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { multiPoligono } from "./postgis";

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ─── Enums ──────────────────────────────────────────────────────────────────

export const monedaEnum = pgEnum("moneda", ["ARS", "USD"]);

/** Unidad en la que se compra, se cotiza y se dosifica el producto (la dosis es "unidad/ha"). */
export const unidadEnum = pgEnum("unidad", [
  "L",
  "kg",
  "u",
  "tn",
  "bolsa",
  "pack",
  "dosis",
]);

export const categoriaProductoEnum = pgEnum("categoria_producto", [
  "herbicida",
  "insecticida",
  "fungicida",
  "fertilizante",
  "semilla",
  /** Adherentes, aceites, correctores (en el Excel: "ADHERENTE"). */
  "coadyuvante",
  "otro",
  "fertilizante_foliar",
  "inoculante",
  "curasemilla",
]);

/** Agrupa los tipos de labor; "cosecha" se separa en el margen bruto. */
export const tipoLaborEnum = pgEnum("tipo_labor", [
  "siembra",
  "pulverizacion",
  "fertilizacion",
  "cosecha",
  "laboreo",
  "otra",
]);

/** Cómo se cotiza una labor: en litros de gasoil por ha (como en el Excel) o en USD/ha fijos. */
export const cotizacionLaborEnum = pgEnum("cotizacion_labor", [
  "litros_gasoil",
  "usd_fijo",
]);

export const estadoRecetaEnum = pgEnum("estado_receta", [
  "borrador",
  "emitida",
  "aplicada",
  "anulada",
]);

// ─── Acceso (PIN único) ─────────────────────────────────────────────────────

/** Sesiones abiertas con el PIN. `id` es el SHA-256 del token que va en la cookie. */
export const sesiones = pgTable("sesiones", {
  id: text().primaryKey(),
  creadoEn: creadoEn(),
  expiraEn: timestamp({ withTimezone: true }).notNull(),
});

/** Intentos de ingreso, para bloquear por IP ante muchos PIN incorrectos. */
export const intentosAcceso = pgTable(
  "intentos_acceso",
  {
    id: id(),
    ip: text().notNull(),
    exitoso: boolean().notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.ip, t.creadoEn)],
);

// ─── Estructura: campos, lotes, campañas ────────────────────────────────────

export const campos = pgTable("campos", {
  id: id(),
  nombre: text().notNull().unique(),
  localidad: text(),
  provincia: text(),
  notas: text(),
  creadoEn: creadoEn(),
});

export const lotes = pgTable(
  "lotes",
  {
    id: id(),
    campoId: integer()
      .notNull()
      .references(() => campos.id),
    nombre: text().notNull(),
    /** Código corto opcional con el que el cliente identifica el lote (ej. "T4", "SM 2"). */
    codigo: text().unique(),
    superficieHa: numeric({ precision: 10, scale: 2 }).notNull(),
    /** Contorno importado de Google Earth (KML/KMZ). */
    contorno: multiPoligono(),
    activo: boolean().notNull().default(true),
    notas: text(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index().on(t.campoId),
    index("lotes_contorno_gist").using("gist", t.contorno),
  ],
);

export const campanias = pgTable("campanias", {
  id: id(),
  /** Ej.: "2025/26" */
  nombre: text().notNull().unique(),
  fechaInicio: date(),
  fechaFin: date(),
});

/** Un cultivo en un lote durante una campaña (permite fina + gruesa el mismo año). */
export const ciclos = pgTable(
  "ciclos",
  {
    id: id(),
    loteId: integer()
      .notNull()
      .references(() => lotes.id),
    campaniaId: integer()
      .notNull()
      .references(() => campanias.id),
    cultivo: text().notNull(),
    variedad: text(),
    fechaSiembra: date(),
    superficieHa: numeric({ precision: 10, scale: 2 }),
    // Cosecha y comercialización (bloque derecho del REGISTRO del Excel).
    fechaCosecha: date(),
    rindeKgHa: numeric({ precision: 10, scale: 2 }),
    /** Precio pizarra en USD/tn. */
    precioPizarra: numeric({ precision: 14, scale: 4 }),
    /** Arrendamiento como fracción de la producción (0,25 = 25%). A confirmar con el cliente. */
    arrendamientoPorcentaje: numeric({ precision: 6, scale: 4 }),
    /** Arrendamiento como kg/ha fijos (alternativa al porcentaje). */
    arrendamientoKgHa: numeric({ precision: 10, scale: 2 }),
    /** Gastos de comercialización como fracción del ingreso (en el Excel, 0,05). */
    gastosComercializacionPorcentaje: numeric({ precision: 6, scale: 4 }),
    /** Flete en USD por tn neta. */
    fleteUsdTn: numeric({ precision: 14, scale: 4 }),
    bonificacionPorcentaje: numeric({ precision: 6, scale: 4 }),
    notas: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.loteId), index().on(t.campaniaId)],
);

// ─── Terceros ───────────────────────────────────────────────────────────────

export const proveedores = pgTable("proveedores", {
  id: id(),
  nombre: text().notNull(),
  localidad: text(),
  contacto: text(),
  creadoEn: creadoEn(),
});

export const contratistas = pgTable("contratistas", {
  id: id(),
  nombre: text().notNull(),
  cuit: text(),
  telefono: text(),
  creadoEn: creadoEn(),
});

/** Quién aporta/paga el insumo o la labor (en el Excel: "APORTE"). A confirmar el significado. */
export const aportes = pgTable("aportes", {
  id: id(),
  nombre: text().notNull().unique(),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

// ─── Parámetros ─────────────────────────────────────────────────────────────

/** Tipo de cambio y precio del gasoil por fecha: se usan para cotizar labores en USD. */
export const cotizaciones = pgTable("cotizaciones", {
  fecha: date().primaryKey(),
  /** ARS por 1 USD. */
  tipoCambio: numeric({ precision: 14, scale: 4 }).notNull(),
  /** ARS por litro de gasoil. */
  precioGasoil: numeric({ precision: 14, scale: 4 }).notNull(),
  creadoEn: creadoEn(),
});

/** Valores por defecto editables (ej. "gastos_comercializacion", "flete_usd_tn"). */
export const configuracion = pgTable("configuracion", {
  clave: text().primaryKey(),
  valor: text().notNull(),
});

// ─── Productos y precios ────────────────────────────────────────────────────

export const productos = pgTable("productos", {
  id: id(),
  nombreComercial: text().notNull().unique(),
  principioActivo: text(),
  concentracion: text(),
  formulacion: text(),
  categoria: categoriaProductoEnum().notNull().default("otro"),
  unidad: unidadEnum().notNull(),
  bandaToxicologica: text(),
  carenciaDias: integer(),
  activo: boolean().notNull().default(true),
  notas: text(),
  creadoEn: creadoEn(),
});

/** Lista de precios con historial: el precio vigente es el de fecha más reciente. */
export const preciosProducto = pgTable(
  "precios_producto",
  {
    id: id(),
    productoId: integer()
      .notNull()
      .references(() => productos.id),
    proveedorId: integer().references(() => proveedores.id),
    moneda: monedaEnum().notNull().default("USD"),
    precioUnitario: numeric({ precision: 14, scale: 4 }).notNull(),
    fecha: date().notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.productoId, t.fecha)],
);

// ─── Catálogo de labores ────────────────────────────────────────────────────

/** Tipos de labor del cliente con su tarifa (en el Excel: hoja "LABORES"). */
export const tiposLabor = pgTable("tipos_labor", {
  id: id(),
  nombre: text().notNull().unique(),
  categoria: tipoLaborEnum().notNull(),
  cotizacion: cotizacionLaborEnum().notNull(),
  /** Si se cotiza en gasoil: litros por ha. */
  litrosGasoilHa: numeric({ precision: 10, scale: 2 }),
  /** Si se cotiza fijo: USD por ha. */
  costoUsdHa: numeric({ precision: 14, scale: 4 }),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

// ─── Recetas ────────────────────────────────────────────────────────────────

export const recetas = pgTable(
  "recetas",
  {
    id: id(),
    numero: integer().notNull(),
    fecha: date().notNull(),
    cicloId: integer()
      .notNull()
      .references(() => ciclos.id),
    plagaObjetivo: text(),
    recomendaciones: text(),
    estado: estadoRecetaEnum().notNull().default("borrador"),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex().on(t.numero), index().on(t.cicloId)],
);

export const recetaItems = pgTable(
  "receta_items",
  {
    id: id(),
    recetaId: integer()
      .notNull()
      .references(() => recetas.id, { onDelete: "cascade" }),
    productoId: integer()
      .notNull()
      .references(() => productos.id),
    dosisPorHa: numeric({ precision: 12, scale: 4 }).notNull(),
  },
  (t) => [index().on(t.recetaId)],
);

// ─── Labores y aplicaciones (lo que realmente se hizo) ──────────────────────

export const labores = pgTable(
  "labores",
  {
    id: id(),
    cicloId: integer()
      .notNull()
      .references(() => ciclos.id),
    recetaId: integer().references(() => recetas.id),
    tipoLaborId: integer()
      .notNull()
      .references(() => tiposLabor.id),
    fecha: date().notNull(),
    superficieHa: numeric({ precision: 10, scale: 2 }).notNull(),
    contratistaId: integer().references(() => contratistas.id),
    aporteId: integer().references(() => aportes.id),
    /** Snapshot del costo de la labor por ha (sale de la tarifa, editable). */
    costoLaborPorHa: numeric({ precision: 14, scale: 4 }),
    monedaLabor: monedaEnum(),
    /** Tipo de cambio ARS/USD usado para esta labor (a definir la fuente con el cliente). */
    tipoCambio: numeric({ precision: 14, scale: 4 }),
    notas: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.cicloId), index().on(t.fecha)],
);

export const laborInsumos = pgTable(
  "labor_insumos",
  {
    id: id(),
    laborId: integer()
      .notNull()
      .references(() => labores.id, { onDelete: "cascade" }),
    productoId: integer()
      .notNull()
      .references(() => productos.id),
    dosisPorHa: numeric({ precision: 12, scale: 4 }).notNull(),
    cantidadTotal: numeric({ precision: 14, scale: 4 }).notNull(),
    /** Snapshot del precio al momento de la aplicación. */
    precioUnitario: numeric({ precision: 14, scale: 4 }).notNull(),
    moneda: monedaEnum().notNull().default("USD"),
  },
  (t) => [index().on(t.laborId)],
);

// ─── Fotos ──────────────────────────────────────────────────────────────────

/**
 * Fotos de un campo, un lote o una labor. El archivo está en Supabase Storage
 * (bucket privado "fotos", ver src/lib/almacenamiento.ts); acá queda la ruta y los datos.
 */
export const fotos = pgTable(
  "fotos",
  {
    id: id(),
    campoId: integer().references(() => campos.id, { onDelete: "cascade" }),
    loteId: integer().references(() => lotes.id, { onDelete: "cascade" }),
    laborId: integer().references(() => labores.id, { onDelete: "cascade" }),
    /** Ruta dentro del bucket, ej. "lotes/12/1727790000000-ab12.jpg". */
    ruta: text().notNull().unique(),
    /** Fecha en que se sacó (por defecto, la de carga). */
    fecha: date().notNull(),
    nota: text(),
    ancho: integer(),
    alto: integer(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index().on(t.campoId),
    index().on(t.loteId),
    index().on(t.laborId),
    // Cada foto pertenece a una sola cosa: campo, lote o labor.
    check("fotos_un_destino", sql`num_nonnulls(${t.campoId}, ${t.loteId}, ${t.laborId}) = 1`),
  ],
);
