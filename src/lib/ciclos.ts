import "server-only";
import { and, eq } from "drizzle-orm";
import { ciclos, lotes } from "@/db/schema";
import type { dbTx } from "@/db";

export type Tx = Parameters<Parameters<typeof dbTx.transaction>[0]>[0];

/** El ciclo es el cultivo del lote en la campaña; si todavía no existe se crea. */
export async function cicloDelLote(tx: Tx, loteId: number, campaniaId: number) {
  const [ciclo] = await tx
    .select({ id: ciclos.id })
    .from(ciclos)
    .where(and(eq(ciclos.loteId, loteId), eq(ciclos.campaniaId, campaniaId)))
    .limit(1);
  if (ciclo) return ciclo.id;

  const [lote] = await tx.select().from(lotes).where(eq(lotes.id, loteId));
  if (!lote) throw new Error("Lote inexistente");
  const [nuevo] = await tx
    .insert(ciclos)
    .values({ loteId: lote.id, campaniaId, cultivo: "Sin definir", superficieHa: lote.superficieHa })
    .returning({ id: ciclos.id });
  return nuevo.id;
}
