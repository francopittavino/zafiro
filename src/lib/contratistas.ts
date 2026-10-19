import "server-only";
import { eq } from "drizzle-orm";
import { contratistas } from "@/db/schema";
import type { Tx } from "./ciclos";

/** El contratista se elige o se escribe uno nuevo: si no existe, se crea. */
export async function contratistaDeNombre(tx: Tx, nombre: string | null) {
  const limpio = nombre?.trim();
  if (!limpio) return null;
  const [existente] = await tx
    .select({ id: contratistas.id })
    .from(contratistas)
    .where(eq(contratistas.nombre, limpio))
    .limit(1);
  if (existente) return existente.id;
  const [nuevo] = await tx.insert(contratistas).values({ nombre: limpio }).returning({ id: contratistas.id });
  return nuevo.id;
}
