"use server";

import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { db, dbTx } from "@/db";
import { configuracion, recetaItems, recetas } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { cicloDelLote } from "@/lib/ciclos";
import { limpiarExtras } from "@/lib/extras";
import { modoDemo } from "@/lib/modo-demo";
import { CLAVES_INGENIERO } from "@/lib/recetas";
import type { ResultadoAlta } from "../acciones-catalogos";

export type DatosReceta = {
  loteId: number;
  fecha: string;
  estado: "borrador" | "emitida" | "aplicada" | "anulada";
  numeroOficial: string;
  superficieHa: number | null;
  plagaObjetivo: string;
  tipoAplicacion: string;
  caudalLHa: number | null;
  fechaAplicacionPrevista: string;
  condiciones: string;
  recomendaciones: string;
  observaciones: string;
  extras: Record<string, string>;
  items: { productoId: number; dosis: number }[];
};

const fechaValida = (f: unknown) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
const opcionalPositivo = (n: unknown) => n === null || (typeof n === "number" && Number.isFinite(n) && n > 0);
const texto = (t: unknown) => (typeof t === "string" ? t.trim() || null : null);

function validar(r: DatosReceta) {
  if (!Number.isInteger(r.loteId)) return "Elegí el lote.";
  if (!fechaValida(r.fecha)) return "La fecha no es válida.";
  if (!["borrador", "emitida", "aplicada", "anulada"].includes(r.estado)) return "El estado no es válido.";
  if (!opcionalPositivo(r.superficieHa)) return "La superficie tiene que ser mayor a 0.";
  if (!opcionalPositivo(r.caudalLHa)) return "El caudal tiene que ser mayor a 0.";
  if (r.fechaAplicacionPrevista && !fechaValida(r.fechaAplicacionPrevista)) return "La fecha de aplicación no es válida.";
  if (!Array.isArray(r.items) || !r.items.every((i) => Number.isInteger(i.productoId) && i.dosis > 0 && Number.isFinite(i.dosis)))
    return "Revisá los productos y sus dosis.";
  return null;
}

/** Crea la receta con el número siguiente (correlativo) o la reemplaza si viene `recetaId`. */
export async function guardarReceta(datos: DatosReceta, recetaId?: number): Promise<ResultadoAlta> {
  await verificarSesion();
  const error = validar(datos);
  if (error) return { ok: false, error };
  if (recetaId !== undefined && !Number.isInteger(recetaId)) return { ok: false, error: "Receta inválida." };
  if (modoDemo()) return { ok: true, demo: true };

  const campania = await campaniaActual();
  if (!campania) return { ok: false, error: "No hay una campaña creada." };
  const extras = await limpiarExtras("receta", datos.extras);

  const id = await dbTx.transaction(async (tx) => {
    const valores = {
      cicloId: await cicloDelLote(tx, datos.loteId, campania.id),
      fecha: datos.fecha,
      estado: datos.estado,
      numeroOficial: texto(datos.numeroOficial),
      superficieHa: datos.superficieHa === null ? null : String(datos.superficieHa),
      plagaObjetivo: texto(datos.plagaObjetivo),
      tipoAplicacion: texto(datos.tipoAplicacion),
      caudalLHa: datos.caudalLHa === null ? null : String(datos.caudalLHa),
      fechaAplicacionPrevista: datos.fechaAplicacionPrevista || null,
      condiciones: texto(datos.condiciones),
      recomendaciones: texto(datos.recomendaciones),
      observaciones: texto(datos.observaciones),
      extras,
    };

    let id = recetaId;
    if (id === undefined) {
      // Con un solo usuario no hay carreras: alcanza con el máximo + 1 dentro de la transacción.
      const [{ ultimo }] = await tx.select({ ultimo: max(recetas.numero) }).from(recetas);
      [{ id }] = await tx
        .insert(recetas)
        .values({ ...valores, numero: (ultimo ?? 0) + 1 })
        .returning({ id: recetas.id });
    } else {
      const actualizadas = await tx.update(recetas).set(valores).where(eq(recetas.id, id)).returning({ id: recetas.id });
      if (!actualizadas.length) return undefined;
      await tx.delete(recetaItems).where(eq(recetaItems.recetaId, id));
    }
    if (datos.items.length) {
      await tx
        .insert(recetaItems)
        .values(datos.items.map((i) => ({ recetaId: id!, productoId: i.productoId, dosisPorHa: String(i.dosis) })));
    }
    return id;
  });

  if (id === undefined) return { ok: false, error: "La receta ya no existe." };
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function eliminarReceta(id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Receta inválida." };
  if (modoDemo()) return { ok: true, demo: true };
  // receta_items se borra en cascada (las labores no se vinculan a recetas: el cliente no compara planificado vs aplicado).
  await db.delete(recetas).where(eq(recetas.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Nombre, matrícula y contacto del ingeniero que salen en los PDF. */
export async function guardarDatosIngeniero(datos: Record<string, string>): Promise<ResultadoAlta> {
  await verificarSesion();
  if (modoDemo()) return { ok: true, demo: true };
  await dbTx.transaction(async (tx) => {
    for (const clave of CLAVES_INGENIERO) {
      const valor = typeof datos[clave] === "string" ? datos[clave].trim().slice(0, 200) : "";
      await tx
        .insert(configuracion)
        .values({ clave, valor })
        .onConflictDoUpdate({ target: configuracion.clave, set: { valor } });
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
