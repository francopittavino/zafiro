"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { movimientosStock } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import type { ResultadoAlta } from "../acciones-catalogos";

const fechaValida = (f: unknown) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
const numero = (n: unknown) => typeof n === "number" && Number.isFinite(n);

export type DatosMovimiento = {
  campoId: number;
  productoId: number;
  fecha: string;
  /** Ingreso: cantidad que entra. Ajuste: cantidad real contada (se guarda la diferencia). */
  tipo: "ingreso" | "ajuste";
  cantidad: number;
  proveedorId?: number | null;
  nota?: string;
};

export async function registrarMovimiento(datos: DatosMovimiento): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(datos.campoId) || !Number.isInteger(datos.productoId))
    return { ok: false, error: "Elegí el campo y el insumo." };
  if (datos.tipo !== "ingreso" && datos.tipo !== "ajuste") return { ok: false, error: "Movimiento inválido." };
  if (!fechaValida(datos.fecha)) return { ok: false, error: "La fecha no es válida." };
  if (!numero(datos.cantidad) || (datos.tipo === "ingreso" ? datos.cantidad <= 0 : datos.cantidad < 0))
    return { ok: false, error: datos.tipo === "ingreso" ? "La cantidad tiene que ser mayor a 0." : "La cantidad no es válida." };
  if (datos.proveedorId != null && !Number.isInteger(datos.proveedorId)) return { ok: false, error: "Proveedor inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  let cantidad = datos.cantidad;
  if (datos.tipo === "ajuste") {
    const [{ actual }] = await db
      .select({ actual: sql<string | null>`sum(${movimientosStock.cantidad})` })
      .from(movimientosStock)
      .where(and(eq(movimientosStock.campoId, datos.campoId), eq(movimientosStock.productoId, datos.productoId)));
    cantidad = datos.cantidad - Number(actual ?? 0);
    if (cantidad === 0) return { ok: false, error: "El stock ya es ese: no hay nada que ajustar." };
  }

  const [fila] = await db
    .insert(movimientosStock)
    .values({
      campoId: datos.campoId,
      productoId: datos.productoId,
      fecha: datos.fecha,
      tipo: datos.tipo,
      cantidad: String(cantidad),
      proveedorId: datos.tipo === "ingreso" ? (datos.proveedorId ?? null) : null,
      nota: datos.nota?.trim() || null,
    })
    .returning({ id: movimientosStock.id });
  revalidatePath("/", "layout");
  return { ok: true, id: fila.id };
}

/** Solo se borran ingresos y ajustes; las aplicaciones se borran editando o eliminando la labor. */
export async function eliminarMovimiento(id: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(id)) return { ok: false, error: "Movimiento inválido." };
  if (modoDemo()) return { ok: true, demo: true };
  await db.delete(movimientosStock).where(and(eq(movimientosStock.id, id), isNull(movimientosStock.laborId)));
  revalidatePath("/", "layout");
  return { ok: true };
}
