"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import {
  aportes,
  campos,
  ciclos,
  cotizaciones,
  lotes,
  preciosProducto,
  productos,
  tiposLabor,
} from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { modoDemo } from "@/lib/modo-demo";
import { CATEGORIAS_LABOR, CATEGORIAS_PRODUCTO, UNIDADES } from "@/lib/catalogos";

/** Altas y ediciones de los catálogos (campos, lotes, insumos, labores, aportes, cotización). */

export type ResultadoAlta = { ok: true; id?: number; demo?: boolean } | { ok: false; error: string };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numeroValido = (v: unknown, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
const fechaValida = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Postgres avisa con 23505 cuando se repite un valor único (nombre, código). */
function esDuplicado(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
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

// ─── Campos ─────────────────────────────────────────────────────────────────

export async function crearCampo(datos: { nombre: string; localidad?: string }): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del campo." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(async () => {
    const [fila] = await db
      .insert(campos)
      .values({ nombre, localidad: texto(datos.localidad) || null })
      .returning({ id: campos.id });
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
  /** Cultivo de la campaña actual (crea o actualiza el ciclo). */
  cultivo?: string;
};

function validarLote(datos: DatosLote) {
  if (!datos.campoId && !texto(datos.nuevoCampo)) return "Elegí el campo o escribí uno nuevo.";
  if (!texto(datos.nombre)) return "Escribí el nombre del lote.";
  if (!numeroValido(datos.ha) || datos.ha <= 0) return "La superficie tiene que ser mayor a 0.";
  return null;
}

/** Crea el lote (o lo actualiza si viene `loteId`) y el cultivo de la campaña actual. */
export async function guardarLote(datos: DatosLote, loteId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const error = validarLote(datos);
  if (error) return { ok: false, error };
  if (loteId !== undefined && !Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  const campania = await campaniaActual();
  const codigo = texto(datos.codigo) || null;
  const cultivo = texto(datos.cultivo);

  return guardar(
    () =>
      dbTx.transaction(async (tx) => {
        let campoId = datos.campoId;
        if (!campoId) {
          const [campo] = await tx
            .insert(campos)
            .values({ nombre: texto(datos.nuevoCampo) })
            .returning({ id: campos.id });
          campoId = campo.id;
        }

        const valores = { campoId, nombre: texto(datos.nombre), codigo, superficieHa: String(datos.ha) };
        let id = loteId;
        if (id === undefined) {
          [{ id }] = await tx.insert(lotes).values(valores).returning({ id: lotes.id });
        } else {
          await tx.update(lotes).set(valores).where(eq(lotes.id, id));
        }

        if (campania && cultivo) {
          const [ciclo] = await tx
            .select({ id: ciclos.id })
            .from(ciclos)
            .where(and(eq(ciclos.loteId, id), eq(ciclos.campaniaId, campania.id)))
            .limit(1);
          if (ciclo) await tx.update(ciclos).set({ cultivo }).where(eq(ciclos.id, ciclo.id));
          else
            await tx
              .insert(ciclos)
              .values({ loteId: id, campaniaId: campania.id, cultivo, superficieHa: String(datos.ha) });
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
  precio: number;
  principioActivo?: string;
};

export async function crearProducto(datos: DatosProducto): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del insumo." };
  const categoria = CATEGORIAS_PRODUCTO.find((c) => c.valor === datos.categoria)?.valor;
  if (!categoria) return { ok: false, error: "Elegí el tipo de insumo." };
  const unidad = UNIDADES.find((u) => u.valor === datos.unidad)?.valor;
  if (!unidad) return { ok: false, error: "Elegí la unidad." };
  if (!numeroValido(datos.precio)) return { ok: false, error: "El precio tiene que ser un número mayor o igual a 0." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(
    () =>
      dbTx.transaction(async (tx) => {
        const [fila] = await tx
          .insert(productos)
          .values({ nombreComercial: nombre, categoria, unidad, principioActivo: texto(datos.principioActivo) || null })
          .returning({ id: productos.id });
        await tx.insert(preciosProducto).values({
          productoId: fila.id,
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

// ─── Aportes ────────────────────────────────────────────────────────────────

export async function crearAporte(datos: { nombre: string }): Promise<ResultadoAlta> {
  await verificarSesion();
  const nombre = texto(datos.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre." };
  if (modoDemo()) return { ok: true, demo: true };

  return guardar(async () => {
    const [fila] = await db.insert(aportes).values({ nombre }).returning({ id: aportes.id });
    return fila.id;
  }, `Ya existe "${nombre}".`);
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
