/**
 * Esquema de datos PRELIMINAR (a validar en la reunión con el cliente).
 * Ver docs/DECISIONES.md, sección "Modelo de dominio".
 *
 * Convenciones:
 * - Montos y dosis en `numeric` (Drizzle los devuelve como string, sin pérdida de precisión).
 * - Cada insumo aplicado guarda el precio del momento (snapshot) para que los
 *   costos históricos no cambien cuando se actualiza la lista de precios.
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
} from "drizzle-orm/pg-core";
import { multiPoligono } from "./postgis";

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ─── Enums ──────────────────────────────────────────────────────────────────

export const monedaEnum = pgEnum("moneda", ["ARS", "USD"]);

export const unidadEnum = pgEnum("unidad", ["L", "kg", "u"]);

export const categoriaProductoEnum = pgEnum("categoria_producto", [
  "herbicida",
  "insecticida",
  "fungicida",
  "fertilizante",
  "semilla",
  "coadyuvante",
  "otro",
]);

export const tipoLaborEnum = pgEnum("tipo_labor", [
  "siembra",
  "pulverizacion",
  "fertilizacion",
  "cosecha",
  "laboreo",
  "otra",
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
  nombre: text().notNull(),
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
    superficieHa: numeric({ precision: 10, scale: 2 }),
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
    rindeKgHa: numeric({ precision: 10, scale: 2 }),
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

// ─── Productos y precios ────────────────────────────────────────────────────

export const productos = pgTable("productos", {
  id: id(),
  nombreComercial: text().notNull(),
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
    moneda: monedaEnum().notNull(),
    precioUnitario: numeric({ precision: 14, scale: 4 }).notNull(),
    fecha: date().notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.productoId, t.fecha)],
);

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
    tipo: tipoLaborEnum().notNull(),
    fecha: date().notNull(),
    superficieHa: numeric({ precision: 10, scale: 2 }).notNull(),
    contratistaId: integer().references(() => contratistas.id),
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
    precioUnitario: numeric({ precision: 14, scale: 4 }),
    moneda: monedaEnum(),
  },
  (t) => [index().on(t.laborId)],
);
