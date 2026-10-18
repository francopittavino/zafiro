"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { dbTx } from "@/db";
import { ciclos } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { campaniaActual } from "@/lib/datos";
import { cicloDelLote } from "@/lib/ciclos";
import { modoDemo } from "@/lib/modo-demo";
import type { ResultadoAlta } from "../acciones-catalogos";

export type DatosCosecha = {
  fecha: string | null;
  rindeKgHa: number;
  precioPizarra: number;
  /** Fracciones: 0,25 = 25%. */
  arrendamientoPorcentaje: number | null;
  gastosComercializacionPorcentaje: number | null;
  fleteUsdTn: number | null;
};

const numero = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const fraccion = (n: unknown) => n === null || (numero(n) && (n as number) <= 1);

/** Guarda la cosecha y la comercialización del ciclo del lote en la campaña actual. */
export async function guardarCosecha(loteId: number, datos: DatosCosecha): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (!numero(datos.rindeKgHa)) return { ok: false, error: "El rinde tiene que ser un número (kg/ha)." };
  if (!numero(datos.precioPizarra)) return { ok: false, error: "El precio tiene que ser un número (USD/tn)." };
  if (!fraccion(datos.arrendamientoPorcentaje) || !fraccion(datos.gastosComercializacionPorcentaje))
    return { ok: false, error: "Los porcentajes tienen que estar entre 0 y 100." };
  if (datos.fleteUsdTn !== null && !numero(datos.fleteUsdTn)) return { ok: false, error: "El flete no es válido." };
  if (datos.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return { ok: false, error: "La fecha no es válida." };
  if (modoDemo()) return { ok: true, demo: true };

  const campania = await campaniaActual();
  if (!campania) return { ok: false, error: "No hay una campaña creada." };
  const texto = (n: number | null) => (n === null ? null : String(n));

  await dbTx.transaction(async (tx) => {
    const cicloId = await cicloDelLote(tx, loteId, campania.id);
    await tx
      .update(ciclos)
      .set({
        fechaCosecha: datos.fecha || null,
        rindeKgHa: String(datos.rindeKgHa),
        precioPizarra: String(datos.precioPizarra),
        arrendamientoPorcentaje: texto(datos.arrendamientoPorcentaje),
        gastosComercializacionPorcentaje: texto(datos.gastosComercializacionPorcentaje),
        fleteUsdTn: texto(datos.fleteUsdTn),
      })
      .where(eq(ciclos.id, cicloId));
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
