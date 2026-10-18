"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, dbTx } from "@/db";
import { ciclos, lotes } from "@/db/schema";
import { verificarSesion } from "@/lib/sesion";
import { SIN_CULTIVO, campaniaDeNombre, campaniaValida, cicloEnCurso } from "@/lib/ciclos";
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

  const ciclo = await cicloEnCurso(db, loteId);
  if (!ciclo) return { ok: false, error: SIN_CULTIVO };
  const cicloId = ciclo.id;
  const texto = (n: number | null) => (n === null ? null : String(n));

  await dbTx.transaction(async (tx) => {
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

const fechaValida = (f: unknown) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));

/** Cierra el cultivo en curso del lote (después de la cosecha): queda para su informe de cierre. */
export async function cerrarCultivo(loteId: number, fecha: string): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (!fechaValida(fecha)) return { ok: false, error: "La fecha de cierre no es válida." };
  if (modoDemo()) return { ok: true, demo: true };

  const ciclo = await cicloEnCurso(db, loteId);
  if (!ciclo) return { ok: false, error: "El lote no tiene un cultivo en curso." };
  await db.update(ciclos).set({ estado: "cerrado", fechaCierre: fecha }).where(eq(ciclos.id, ciclo.id));
  revalidatePath("/", "layout");
  return { ok: true, id: ciclo.id };
}

/** Vuelve a abrir un cultivo cerrado (por si se cerró por error), si el lote no empezó otro. */
export async function reabrirCultivo(cicloId: number): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(cicloId)) return { ok: false, error: "Cultivo inválido." };
  if (modoDemo()) return { ok: true, demo: true };

  const [ciclo] = await db.select({ loteId: ciclos.loteId }).from(ciclos).where(eq(ciclos.id, cicloId));
  if (!ciclo) return { ok: false, error: "El cultivo ya no existe." };
  if (await cicloEnCurso(db, ciclo.loteId))
    return { ok: false, error: "El lote ya tiene otro cultivo en curso: cerralo primero." };
  await db.update(ciclos).set({ estado: "en_curso", fechaCierre: null }).where(eq(ciclos.id, cicloId));
  revalidatePath("/", "layout");
  return { ok: true, id: cicloId };
}

export type DatosNuevoCultivo = {
  cultivo: string;
  variedad: string;
  fechaSiembra: string;
  /** Nombre de la campaña (ej. "2025/26"); si no existe, se crea. */
  campania: string;
};

/** Inicia un cultivo nuevo en el lote (el anterior tiene que estar cerrado). */
export async function iniciarCultivo(loteId: number, datos: DatosNuevoCultivo): Promise<ResultadoAlta> {
  await verificarSesion();
  if (!Number.isInteger(loteId)) return { ok: false, error: "Lote inválido." };
  if (!datos.cultivo?.trim()) return { ok: false, error: "Escribí el cultivo." };
  if (!campaniaValida(datos.campania)) return { ok: false, error: "La campaña tiene que ser como 2025/26." };
  if (datos.fechaSiembra && !fechaValida(datos.fechaSiembra)) return { ok: false, error: "La fecha de siembra no es válida." };
  if (modoDemo()) return { ok: true, demo: true };

  if (await cicloEnCurso(db, loteId))
    return { ok: false, error: "El lote ya tiene un cultivo en curso: cerralo antes de iniciar otro." };
  const [lote] = await db.select({ ha: lotes.superficieHa }).from(lotes).where(eq(lotes.id, loteId));
  if (!lote) return { ok: false, error: "El lote ya no existe." };

  const id = await dbTx.transaction(async (tx) => {
    const campaniaId = await campaniaDeNombre(tx, datos.campania);
    const [nuevo] = await tx
      .insert(ciclos)
      .values({
        loteId,
        campaniaId,
        cultivo: datos.cultivo.trim(),
        variedad: datos.variedad.trim() || null,
        fechaSiembra: datos.fechaSiembra || null,
        superficieHa: lote.ha,
      })
      .returning({ id: ciclos.id });
    return nuevo.id;
  });
  revalidatePath("/", "layout");
  return { ok: true, id };
}
