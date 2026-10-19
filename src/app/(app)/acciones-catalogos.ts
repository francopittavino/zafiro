"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import {
  aportes,
  campos,
  camposPersonalizados,
  categoriasGasto,
  ciclos,
  contratistas,
  cotizaciones,
  lotes,
  preciosProducto,
  productores,
  productos,
  proveedores,
  tiposLabor,
  type Dibujo,
} from "@/db/schema";
import { dibujoValido } from "@/lib/dibujo";
import { campaniaDeNombre, campaniaValida, cicloEnCurso } from "@/lib/ciclos";
import { campaniaSugerida } from "@/lib/formato";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { limpiarExtras } from "@/lib/extras";
import { modoDemo } from "@/lib/modo-demo";
import { CATEGORIAS_LABOR, CATEGORIAS_PRODUCTO, UNIDADES } from "@/lib/catalogos";

/** Altas y ediciones de los catálogos (productores, campos, lotes, insumos, labores, listas, cotización). */

export type ResultadoAlta = { ok: true; id?: number; demo?: boolean } | { ok: false; error: string };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** Texto opcional: vacío → null. */
const opcional = (v: unknown) => texto(v) || null;
const numeroValido = (v: unknown, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
const fechaValida = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
/** Número opcional para una columna numeric: null o un número válido. */
const numeroOpcional = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const fechaOpcional = (v: unknown) => (fechaValida(v) ? (v as string) : null);
// Las coordenadas son obligatorias en campos y lotes (pedido del cliente).
const latitudValida = (v: unknown) => numeroValido(v, -90) && (v as number) <= 90;
const longitudValida = (v: unknown) => numeroValido(v, -180) && (v as number) <= 180;
const MENSAJE_COORDENADAS = `Completá la latitud y la longitud (ej. 32°28'57.14"S y 59°15'19.07"O).`;

/** Postgres avisa con 23505 cuando se repite un valor único (nombre, código). */
function esDuplicado(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** 23503: se quiere borrar algo que otra tabla todavía usa. */
function estaEnUso(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23503" || e?.cause?.code === "23503";
}

async function guardar(alta: () => Promise<number | undefined>, duplicado: string): Promise<ResultadoAlta> {
  try {
    const id = await alta();
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (error) {
    if (esDuplicado(error)) return { ok: false, error: duplicado };
    throw error;
  }
}

const idValido = (id: unknown) => id === undefined || Number.isInteger(id);

// ─── Productores ────────────────────────────────────────────────────────────

export type DatosProductor = {
  nombre: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  localidad?: string;
  notas?: string;
};

export async function guardarProductor(datos: DatosProductor, productorId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del productor." };
  if (!idValido(productorId)) return { ok: false, error: "Productor inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  const valores = {
    nombre,
    cuit: opcional(datos.cuit),
    telefono: opcional(datos.telefono),
    email: opcional(datos.email),
    localidad: opcional(datos.localidad),
    notas: opcional(datos.notas),
  };
  return guardar(async () => {
    if (productorId !== undefined) {
      await db.update(productores).set(valores).where(eq(productores.id, productorId));
      return productorId;
    }
    const [fila] = await db.insert(productores).values(valores).returning({ id: productores.id });
    return fila.id;
  }, `Ya existe un productor llamado "${nombre}".`);
}

// ─── Campos ─────────────────────────────────────────────────────────────────

export type DatosCampo = {
  nombre: string;
  productorId?: number | null;
  localidad?: string;
  provincia?: string;
  latitud?: number | null;
  longitud?: number | null;
  notas?: string;
  extras?: Record<string, string>;
};

export async function guardarCampo(datos: DatosCampo, campoId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del campo." };
  if (!idValido(campoId) || (datos.productorId != null && !Number.isInteger(datos.productorId)))
    return { ok: false, error: "Datos inválidos." };
  if (!latitudValida(datos.latitud) || !longitudValida(datos.longitud)) return { ok: false, error: MENSAJE_COORDENADAS };
  if (modoDemo()) return { ok: true, demo: true };

  const valores = {
    nombre,
    productorId: datos.productorId ?? null,
    localidad: opcional(datos.localidad),
    provincia: opcional(datos.provincia),
    latitud: numeroOpcional(datos.latitud),
    longitud: numeroOpcional(datos.longitud),
    notas: opcional(datos.notas),
    extras: await limpiarExtras("campo", datos.extras),
  };
  return guardar(async () => {
    if (campoId !== undefined) {
      await db.update(campos).set(valores).where(eq(campos.id, campoId));
      return campoId;
    }
    const [fila] = await db.insert(campos).values(valores).returning({ id: campos.id });
    return fila.id;
  }, `Ya existe un campo llamado "${nombre}".`);
}

// ─── Lotes ──────────────────────────────────────────────────────────────────

export type DatosLote = {
  /** Campo existente, o `nuevoCampo` para crearlo en el momento. */
  campoId: number | null;
  nuevoCampo?: string;
  nombre: string;
  codigo?: string;
  ha: number;
  /** Cultivo en curso (lo actualiza, o lo inicia si el lote no tiene), con su variedad y fecha de siembra. */
  cultivo?: string;
  /** Campaña del cultivo si se inicia uno nuevo (ej. "2025/26"). */
  campania?: string;
  variedad?: string;
  fechaSiembra?: string;
  tenencia?: "propio" | "alquilado" | null;
  tipoSuelo?: string;
  latitud?: number | null;
  longitud?: number | null;
  notas?: string;
  extras?: Record<string, string>;
  /** Contorno sobre la foto del campo: undefined no lo toca, null lo borra. */
  dibujo?: Dibujo | null;
};

function validarLote(datos: DatosLote) {
  if (!datos.campoId && !texto(datos.nuevoCampo)) return "Elegí el campo o escribí uno nuevo.";
  if (!texto(datos.nombre)) return "Escribí el nombre del lote.";
  if (!numeroValido(datos.ha) || datos.ha <= 0) return "La superficie tiene que ser mayor a 0.";
  if (datos.tenencia != null && datos.tenencia !== "propio" && datos.tenencia !== "alquilado")
    return "La tenencia no es válida.";
  if (datos.fechaSiembra && !fechaValida(datos.fechaSiembra)) return "La fecha de siembra no es válida.";
  if (!latitudValida(datos.latitud) || !longitudValida(datos.longitud)) return MENSAJE_COORDENADAS;
  if (datos.campania && !campaniaValida(datos.campania)) return "La campaña tiene que ser como 2025/26.";
  if (datos.dibujo != null && !dibujoValido(datos.dibujo)) return "Marcá al menos 3 puntos del lote en el mapa.";
  return null;
}

/** Crea el lote (o lo actualiza si viene `loteId`) y el cultivo de la campaña actual. */
export async function guardarLote(datos: DatosLote, loteId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const error = validarLote(datos);
  if (error) return { ok: false, error };
  if (!idValido(loteId)) return { ok: false, error: "Lote inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  const codigo = texto(datos.codigo) || null;
  const cultivo = texto(datos.cultivo);
  const extras = await limpiarExtras("lote", datos.extras);

  return guardar(
    () =>
      dbTx.transaction(async (tx) => {
        let campoId = datos.campoId;
        if (!campoId) {
          const [campo] = await tx
            .insert(campos)
            // El campo nuevo toma la ubicación del lote (las coordenadas son obligatorias).
            .values({
              nombre: texto(datos.nuevoCampo),
              latitud: numeroOpcional(datos.latitud),
              longitud: numeroOpcional(datos.longitud),
            })
            .returning({ id: campos.id });
          campoId = campo.id;
        }

        const valores = {
          campoId,
          nombre: texto(datos.nombre),
          codigo,
          superficieHa: String(datos.ha),
          tenencia: datos.tenencia ?? null,
          tipoSuelo: opcional(datos.tipoSuelo),
          latitud: numeroOpcional(datos.latitud),
          longitud: numeroOpcional(datos.longitud),
          notas: opcional(datos.notas),
          extras,
          ...(datos.dibujo !== undefined && { dibujo: datos.dibujo }),
        };
        let id = loteId;
        if (id === undefined) {
          [{ id }] = await tx.insert(lotes).values(valores).returning({ id: lotes.id });
        } else {
          await tx.update(lotes).set(valores).where(eq(lotes.id, id));
        }

        if (cultivo) {
          const ciclo = { cultivo, variedad: opcional(datos.variedad), fechaSiembra: fechaOpcional(datos.fechaSiembra) };
          const existente = await cicloEnCurso(tx, id);
          if (existente) await tx.update(ciclos).set(ciclo).where(eq(ciclos.id, existente.id));
          else {
            const campaniaId = datos.campania
              ? await campaniaDeNombre(tx, datos.campania)
              : ((await campaniaActual())?.id ?? (await campaniaDeNombre(tx, campaniaSugerida())));
            if (campaniaId)
              await tx.insert(ciclos).values({ loteId: id, campaniaId, superficieHa: String(datos.ha), ...ciclo });
          }
        }
        return id;
      }),
    "Ya existe un lote con ese código (o un campo con ese nombre).",
  );
}

// ─── Insumos ────────────────────────────────────────────────────────────────

export type DatosProducto = {
  nombre: string;
  categoria: string;
  unidad: string;
  /** Solo en el alta: el primer precio. Después se cambia con "Nuevo precio". */
  precio?: number;
  proveedorId?: number | null;
  principioActivo?: string;
  concentracion?: string;
  formulacion?: string;
  presentacion?: string;
  bandaToxicologica?: string;
  carenciaDias?: number | null;
  notas?: string;
  extras?: Record<string, string>;
};

export async function guardarProducto(datos: DatosProducto, productoId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del insumo." };
  const categoria = CATEGORIAS_PRODUCTO.find((c) => c.valor === datos.categoria)?.valor;
  if (!categoria) return { ok: false, error: "Elegí el tipo de insumo." };
  const unidad = UNIDADES.find((u) => u.valor === datos.unidad)?.valor;
  if (!unidad) return { ok: false, error: "Elegí la unidad." };
  if (!idValido(productoId)) return { ok: false, error: "Insumo inválido." };
  if (productoId === undefined && !numeroValido(datos.precio))
    return { ok: false, error: "El precio tiene que ser un número mayor o igual a 0." };
  if (datos.carenciaDias != null && !(Number.isInteger(datos.carenciaDias) && datos.carenciaDias >= 0))
    return { ok: false, error: "La carencia tiene que ser una cantidad de días." };
  if (datos.proveedorId != null && !Number.isInteger(datos.proveedorId)) return { ok: false, error: "Proveedor inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  const valores = {
    nombreComercial: nombre,
    categoria,
    unidad,
    principioActivo: opcional(datos.principioActivo),
    concentracion: opcional(datos.concentracion),
    formulacion: opcional(datos.formulacion),
    presentacion: opcional(datos.presentacion),
    bandaToxicologica: opcional(datos.bandaToxicologica),
    carenciaDias: datos.carenciaDias ?? null,
    notas: opcional(datos.notas),
    extras: await limpiarExtras("producto", datos.extras),
  };

  return guardar(
    () =>
      dbTx.transaction(async (tx) => {
        if (productoId !== undefined) {
          await tx.update(productos).set(valores).where(eq(productos.id, productoId));
          return productoId;
        }
        const [fila] = await tx.insert(productos).values(valores).returning({ id: productos.id });
        await tx.insert(preciosProducto).values({
          productoId: fila.id,
          proveedorId: datos.proveedorId ?? null,
          precioUnitario: String(datos.precio),
          moneda: "USD",
          fecha: new Date().toLocaleDateString("en-CA"),
        });
        return fila.id;
      }),
    `Ya existe un insumo llamado "${nombre}".`,
  );
}

// ─── Tipos de labor ─────────────────────────────────────────────────────────

export type DatosTipoLabor = {
  nombre: string;
  categoria: string;
  cotizacion: "litros_gasoil" | "usd_fijo";
  valor: number;
};

export async function crearTipoLabor(datos: DatosTipoLabor): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre de la labor." };
  const categoria = CATEGORIAS_LABOR.find((c) => c.valor === datos.categoria)?.valor;
  if (!categoria) return { ok: false, error: "Elegí el tipo de labor." };
  if (datos.cotizacion !== "litros_gasoil" && datos.cotizacion !== "usd_fijo")
    return { ok: false, error: "Elegí cómo se cotiza." };
  if (!numeroValido(datos.valor)) return { ok: false, error: "La tarifa tiene que ser un número mayor o igual a 0." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(async () => {
    const [fila] = await db
      .insert(tiposLabor)
      .values({
        nombre,
        categoria,
        cotizacion: datos.cotizacion,
        litrosGasoilHa: datos.cotizacion === "litros_gasoil" ? String(datos.valor) : null,
        costoUsdHa: datos.cotizacion === "usd_fijo" ? String(datos.valor) : null,
      })
      .returning({ id: tiposLabor.id });
    return fila.id;
  }, `Ya existe una labor llamada "${nombre}".`);
}

// ─── Listas simples (Ajustes) ───────────────────────────────────────────────

/** Listas de solo un nombre que se editan en Ajustes. */
export type ListaSimple = "aportes" | "contratistas" | "proveedores" | "categoriasGasto";

const LISTAS = {
  aportes: { tabla: aportes, cosa: "aporte" },
  contratistas: { tabla: contratistas, cosa: "contratista" },
  proveedores: { tabla: proveedores, cosa: "proveedor" },
  categoriasGasto: { tabla: categoriasGasto, cosa: "categoría" },
} as const;

export async function crearEnLista(lista: ListaSimple, datos: { nombre: string }): Promise<ResultadoAlta> {
  await verificarSesion();
  const config = LISTAS[lista];
  if (!config) return { ok: false, error: "Lista inválida." };
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(async () => {
    const [fila] = await db.insert(config.tabla).values({ nombre }).returning({ id: config.tabla.id });
    return fila.id;
  }, `Ya existe "${nombre}".`);
}

/** Borra un elemento de una lista; si ya se usó en algún registro, solo lo oculta (o avisa). */
export async function quitarDeLista(lista: ListaSimple, id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const config = LISTAS[lista];
  if (!config || !Number.isInteger(id)) return { ok: false, error: "Datos inválidos." };
  if (modoDemo()) return { ok: true, demo: true };

  try {
    await db.delete(config.tabla).where(eq(config.tabla.id, id));
  } catch (error) {
    if (!estaEnUso(error)) throw error;
    if (lista === "aportes") await db.update(aportes).set({ activo: false }).where(eq(aportes.id, id));
    else if (lista === "categoriasGasto")
      await db.update(categoriasGasto).set({ activo: false }).where(eq(categoriasGasto.id, id));
    else return { ok: false, error: `No se puede quitar: el ${config.cosa} ya se usó en registros cargados.` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Compatibilidad con el formulario de labor ("+ Nuevo…" de aporte). */
export async function crearAporte(datos: { nombre: string }) {
  return crearEnLista("aportes", datos);
}

// ─── Campos personalizados ──────────────────────────────────────────────────

export async function crearCampoPersonalizado(datos: {
  entidad: string;
  nombre: string;
  tipo: string;
}): Promise<ResultadoAlta> {
  await verificarSesion();
  const entidad = (["campo", "lote", "producto", "labor", "receta"] as const).find((e) => e === datos.entidad);
  const tipo = (["texto", "numero", "fecha"] as const).find((t) => t === datos.tipo);
  const nombre = texto(datos.nombre);
  if (!entidad || !tipo) return { ok: false, error: "Datos inválidos." };
  if (!nombre) return { ok: false, error: "Escribí el nombre del dato." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(async () => {
    // Si se había quitado uno con el mismo nombre, se vuelve a activar (conserva los valores cargados).
    const [previo] = await db
      .update(camposPersonalizados)
      .set({ activo: true, tipo })
      .where(and(eq(camposPersonalizados.entidad, entidad), eq(camposPersonalizados.nombre, nombre)))
      .returning({ id: camposPersonalizados.id });
    if (previo) return previo.id;
    const [fila] = await db
      .insert(camposPersonalizados)
      .values({ entidad, nombre, tipo, orden: Date.now() % 1_000_000_000 })
      .returning({ id: camposPersonalizados.id });
    return fila.id;
  }, `Ya existe el dato "${nombre}".`);
}

/** Se oculta (no se borra) para no perder lo que ya se cargó. */
export async function quitarCampoPersonalizado(id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Dato inválido." };
  if (modoDemo()) return { ok: true, demo: true };
  await db.update(camposPersonalizados).set({ activo: false }).where(eq(camposPersonalizados.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Cotización (tipo de cambio y gasoil) ───────────────────────────────────

export async function guardarCotizacion(datos: {
  fecha: string;
  tipoCambio: number;
  precioGasoil: number;
}): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!fechaValida(datos.fecha)) return { ok: false, error: "La fecha no es válida." };
  if (!numeroValido(datos.tipoCambio) || datos.tipoCambio <= 0)
    return { ok: false, error: "El tipo de cambio tiene que ser mayor a 0." };
  if (!numeroValido(datos.precioGasoil)) return { ok: false, error: "El precio del gasoil no es válido." };
  if (modoDemo()) return { ok: true, demo: true };

  const valores = { tipoCambio: String(datos.tipoCambio), precioGasoil: String(datos.precioGasoil) };
  // Una cotización por día: si ya hay una para esa fecha, se reemplaza.
  await db
    .insert(cotizaciones)
    .values({ fecha: datos.fecha, ...valores })
    .onConflictDoUpdate({ target: cotizaciones.fecha, set: valores });
  revalidatePath("/", "layout");
  return { ok: true };
}
