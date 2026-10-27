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
  jsonb,
  type AnyPgColumn,
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

/** Orden de trabajo: se arma antes de hacer la labor; al registrarla pasa a "realizada". */
export const estadoOrdenEnum = pgEnum("estado_orden", ["pendiente", "enviada", "realizada", "anulada"]);

export const tenenciaEnum = pgEnum("tenencia", ["propio", "alquilado"]);

/** El cultivo del lote está en curso hasta que se cierra a mano (después de la cosecha). */
export const estadoCicloEnum = pgEnum("estado_ciclo", ["en_curso", "cerrado"]);

/** Quién hace la labor: máquinas propias o un contratista. */
export const modalidadLaborEnum = pgEnum("modalidad_labor", ["propia", "contratista"]);

/** Cómo se cobra la labor: por hectárea o por hora. */
export const cobroLaborEnum = pgEnum("cobro_labor", ["ha", "hora"]);

/** Movimientos de stock de un campo: ingreso (compra), aplicación (sale sola al cargar una labor) o ajuste. */
export const tipoMovimientoStockEnum = pgEnum("tipo_movimiento_stock", ["ingreso", "aplicacion", "ajuste"]);

/** Qué cosas aceptan campos personalizados (los agrega el usuario desde Ajustes). */
export const entidadPersonalizableEnum = pgEnum("entidad_personalizable", [
  "campo",
  "lote",
  "producto",
  "labor",
  "receta",
]);

export const tipoDatoEnum = pgEnum("tipo_dato", ["texto", "numero", "fecha"]);

/** Valores de los campos personalizados: id del campo personalizado (como texto) → valor. */
export type Extras = Record<string, string>;

/**
 * Figura dibujada sobre la foto del campo (mapa propio, sin GIS): puntos [x, y]
 * relativos a la imagen, de 0 a 1, para que no dependa del tamaño en pantalla.
 */
export type Dibujo = [number, number][];

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

/**
 * Productores a los que asesora el ingeniero. No usan el sistema: reciben los
 * informes y recetas en PDF.
 */
export const productores = pgTable("productores", {
  id: id(),
  nombre: text().notNull().unique(),
  cuit: text(),
  telefono: text(),
  email: text(),
  localidad: text(),
  notas: text(),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const campos = pgTable("campos", {
  id: id(),
  nombre: text().notNull().unique(),
  productorId: integer().references(() => productores.id),
  localidad: text(),
  provincia: text(),
  latitud: numeric({ precision: 9, scale: 6 }),
  longitud: numeric({ precision: 9, scale: 6 }),
  extras: jsonb().$type<Extras>(),
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
    /** Contorno marcado sobre uno de los mapas del campo (`mapaId`). */
    dibujo: jsonb().$type<Dibujo>(),
    /** Foto del campo (un mapa) sobre la que está marcado el lote; sin ella el dibujo no vale. */
    mapaId: integer().references((): AnyPgColumn => fotos.id, { onDelete: "set null" }),
    tenencia: tenenciaEnum(),
    tipoSuelo: text(),
    latitud: numeric({ precision: 9, scale: 6 }),
    longitud: numeric({ precision: 9, scale: 6 }),
    extras: jsonb().$type<Extras>(),
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
    estado: estadoCicloEnum().notNull().default("en_curso"),
    fechaCierre: date(),
    notas: text(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index().on(t.loteId),
    index().on(t.campaniaId),
    // Un solo cultivo en curso por lote: el siguiente se inicia al cerrar el anterior.
    uniqueIndex("ciclos_un_cultivo_en_curso").on(t.loteId).where(sql`${t.estado} = 'en_curso'`),
  ],
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
  /** Ej. "Bidón 20 L". */
  presentacion: text(),
  extras: jsonb().$type<Extras>(),
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

/**
 * Resumen propio de la receta fitosanitaria oficial (Entre Ríos): solo los datos
 * necesarios para mandarle al productor en PDF. Todo opcional salvo número, fecha y lote.
 */
export const recetas = pgTable(
  "recetas",
  {
    id: id(),
    /** Correlativo. */
    numero: integer().notNull(),
    fecha: date().notNull(),
    cicloId: integer()
      .notNull()
      .references(() => ciclos.id),
    /** Número de la receta oficial de la provincia, si la hay. */
    numeroOficial: text(),
    superficieHa: numeric({ precision: 10, scale: 2 }),
    plagaObjetivo: text(),
    /** Ej. "Terrestre", "Aérea", "Dron". */
    tipoAplicacion: text(),
    caudalLHa: numeric({ precision: 10, scale: 2 }),
    fechaAplicacionPrevista: date(),
    /** Condiciones climáticas y distancias a zonas urbanas o cursos de agua. */
    condiciones: text(),
    recomendaciones: text(),
    observaciones: text(),
    extras: jsonb().$type<Extras>(),
    /** PDF de la receta oficial de la provincia (ruta en el bucket "documentos"). */
    archivoOficial: text(),
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
    modalidad: modalidadLaborEnum(),
    contratistaId: integer().references(() => contratistas.id),
    aporteId: integer().references(() => aportes.id),
    /** Por ha: costo = costoLaborPorHa × ha. Por hora: costo = horas × costoHora. */
    cobro: cobroLaborEnum().notNull().default("ha"),
    /** Snapshot del costo de la labor por ha (sale de la tarifa, editable). */
    costoLaborPorHa: numeric({ precision: 14, scale: 4 }),
    horas: numeric({ precision: 10, scale: 2 }),
    /** USD por hora. */
    costoHora: numeric({ precision: 14, scale: 4 }),
    monedaLabor: monedaEnum(),
    /** Tipo de cambio ARS/USD usado para esta labor (a definir la fuente con el cliente). */
    tipoCambio: numeric({ precision: 14, scale: 4 }),
    // Datos de la aplicación (todos opcionales).
    caudalLHa: numeric({ precision: 10, scale: 2 }),
    temperatura: numeric({ precision: 5, scale: 1 }),
    humedad: numeric({ precision: 5, scale: 1 }),
    vientoKmH: numeric({ precision: 5, scale: 1 }),
    vientoDireccion: text(),
    aplicador: text(),
    /** Si se aplicó solo una parte (manchones): figuras marcadas sobre la foto del campo. */
    zonas: jsonb().$type<Dibujo[]>(),
    extras: jsonb().$type<Extras>(),
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

// ─── Órdenes de trabajo (lo que se va a hacer) ──────────────────────────────

/**
 * Lo que se va a hacer en un lote, para mandarle al productor en PDF antes de hacerlo:
 * la labor, quién la hace, los productos (con la receta, si hay), y los costos estimados.
 * Cuando se hace, se registra como labor desde la orden (`laborId`).
 */
export const ordenesTrabajo = pgTable(
  "ordenes_trabajo",
  {
    id: id(),
    /** Correlativo. */
    numero: integer().notNull(),
    fecha: date().notNull(),
    cicloId: integer()
      .notNull()
      .references(() => ciclos.id),
    recetaId: integer().references(() => recetas.id, { onDelete: "set null" }),
    tipoLaborId: integer().references(() => tiposLabor.id),
    fechaPrevista: date(),
    superficieHa: numeric({ precision: 10, scale: 2 }).notNull(),
    modalidad: modalidadLaborEnum(),
    contratistaId: integer().references(() => contratistas.id),
    cobro: cobroLaborEnum().notNull().default("ha"),
    costoLaborPorHa: numeric({ precision: 14, scale: 4 }),
    horas: numeric({ precision: 10, scale: 2 }),
    costoHora: numeric({ precision: 14, scale: 4 }),
    /** Indicaciones para quien hace el trabajo (ej. caudal, pastillas, horario). */
    instrucciones: text(),
    observaciones: text(),
    /** Si el PDF muestra precios y costos (a veces se manda solo lo que hay que hacer). */
    mostrarCostos: boolean().notNull().default(true),
    estado: estadoOrdenEnum().notNull().default("pendiente"),
    /** Labor que se registró a partir de esta orden. */
    laborId: integer().references(() => labores.id, { onDelete: "set null" }),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex().on(t.numero), index().on(t.cicloId)],
);

export const ordenItems = pgTable(
  "orden_items",
  {
    id: id(),
    ordenId: integer()
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),
    productoId: integer()
      .notNull()
      .references(() => productos.id),
    dosisPorHa: numeric({ precision: 12, scale: 4 }).notNull(),
    /** Precio estimado (USD por unidad): sale de la lista y se puede cambiar. */
    precioUnitario: numeric({ precision: 14, scale: 4 }).notNull(),
  },
  (t) => [index().on(t.ordenId)],
);

/** Otros gastos estimados de la orden (flete, alquiler de equipo…), en USD. */
export const ordenGastos = pgTable(
  "orden_gastos",
  {
    id: id(),
    ordenId: integer()
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),
    concepto: text().notNull(),
    importe: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (t) => [index().on(t.ordenId)],
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
    /** Foto del campo que se usa de mapa (un campo puede tener varios; ver `lotes.mapaId`). */
    esMapa: boolean().notNull().default(false),
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

// ─── Campos personalizados ──────────────────────────────────────────────────

/**
 * Datos extra que el usuario agrega a campos, lotes, insumos, labores o recetas
 * ("que se puedan agregar o quitar"). Los valores van en la columna `extras` de cada tabla.
 */
export const camposPersonalizados = pgTable(
  "campos_personalizados",
  {
    id: id(),
    entidad: entidadPersonalizableEnum().notNull(),
    nombre: text().notNull(),
    tipo: tipoDatoEnum().notNull().default("texto"),
    orden: integer().notNull().default(0),
    activo: boolean().notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex().on(t.entidad, t.nombre)],
);

// ─── Otros gastos (alquiler, flete, seguros…) ──────────────────────────────

export const categoriasGasto = pgTable("categorias_gasto", {
  id: id(),
  nombre: text().notNull().unique(),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

/**
 * Gastos que no son labores ni insumos. Pueden ser de un lote (ciclo), de un campo
 * entero (se reparten entre sus lotes por hectárea) o generales de la campaña.
 */
export const gastos = pgTable(
  "gastos",
  {
    id: id(),
    campaniaId: integer()
      .notNull()
      .references(() => campanias.id),
    cicloId: integer().references(() => ciclos.id, { onDelete: "cascade" }),
    campoId: integer().references(() => campos.id, { onDelete: "cascade" }),
    categoriaId: integer()
      .notNull()
      .references(() => categoriasGasto.id),
    fecha: date().notNull(),
    descripcion: text(),
    importeUsd: numeric({ precision: 14, scale: 2 }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index().on(t.campaniaId),
    index().on(t.cicloId),
    index().on(t.campoId),
    check("gastos_un_destino", sql`num_nonnulls(${t.cicloId}, ${t.campoId}) <= 1`),
  ],
);

// ─── Stock por campo ────────────────────────────────────────────────────────

/**
 * Stock de insumos en cada campo = suma de los movimientos. Las aplicaciones se generan
 * solas al guardar una labor (cantidad negativa) y se borran con ella.
 */
export const movimientosStock = pgTable(
  "movimientos_stock",
  {
    id: id(),
    campoId: integer()
      .notNull()
      .references(() => campos.id),
    productoId: integer()
      .notNull()
      .references(() => productos.id),
    fecha: date().notNull(),
    tipo: tipoMovimientoStockEnum().notNull(),
    /** Positiva entra, negativa sale (en la unidad del producto). */
    cantidad: numeric({ precision: 14, scale: 4 }).notNull(),
    laborId: integer().references(() => labores.id, { onDelete: "cascade" }),
    proveedorId: integer().references(() => proveedores.id),
    nota: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.campoId, t.productoId), index().on(t.laborId)],
);
