import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { camposPersonalizados, type Extras } from "@/db/schema";
import type { EntidadPersonalizable } from "./datos";

/**
 * Deja solo los valores de campos personalizados activos de esa entidad, recortados y
 * sin vacíos. Lo que llega del navegador no es confiable. Sin valores → null.
 */
export async function limpiarExtras(entidad: EntidadPersonalizable, extras: unknown): Promise<Extras | null> {
  if (!extras || typeof extras !== "object") return null;
  const validos = await db
    .select({ id: camposPersonalizados.id })
    .from(camposPersonalizados)
    .where(and(eq(camposPersonalizados.entidad, entidad), eq(camposPersonalizados.activo, true)));

  const limpio: Extras = {};
  for (const { id } of validos) {
    const valor = (extras as Record<string, unknown>)[String(id)];
    if (typeof valor === "string" && valor.trim()) limpio[String(id)] = valor.trim().slice(0, 2000);
  }
  return Object.keys(limpio).length ? limpio : null;
}
