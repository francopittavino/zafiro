"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { preciosProducto, productos } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import type { Resultado } from "../registrar/acciones";

/**
 * Agrega un precio al historial del producto. El vigente es el de fecha más reciente;
 * las labores ya cargadas no cambian porque guardan su propio precio (snapshot).
 */
export async function agregarPrecio(productoId: number, precio: number, fecha: string): Promise<Resultado> {
  await verificarSesion();

  if (!Number.isInteger(productoId)) return { ok: false, error: "Producto inválido." };
  if (typeof precio !== "number" || !Number.isFinite(precio) || precio < 0)
    return { ok: false, error: "El precio tiene que ser un número mayor o igual a 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
    return { ok: false, error: "La fecha no es válida." };
  if (modoDemo()) return { ok: true, demo: true };

  const [producto] = await db.select({ id: productos.id }).from(productos).where(eq(productos.id, productoId));
  if (!producto) return { ok: false, error: "El producto ya no existe." };

  await db.insert(preciosProducto).values({ productoId, precioUnitario: String(precio), fecha, moneda: "USD" });
  revalidatePath("/", "layout");
  return { ok: true };
}
