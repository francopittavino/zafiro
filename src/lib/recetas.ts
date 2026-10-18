import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ciclos, configuracion, recetaItems, recetas, type Extras } from "@/db/schema";
import { obtenerDatos } from "./datos";
import { modoDemo } from "./modo-demo";

export type EstadoReceta = "borrador" | "emitida" | "aplicada" | "anulada";

export type Receta = {
  id: number;
  numero: number;
  fecha: string;
  loteId: number;
  estado: EstadoReceta;
  numeroOficial: string | null;
  superficieHa: number | null;
  plagaObjetivo: string | null;
  tipoAplicacion: string | null;
  caudalLHa: number | null;
  fechaAplicacionPrevista: string | null;
  condiciones: string | null;
  recomendaciones: string | null;
  observaciones: string | null;
  extras: Extras | null;
  items: { productoId: number; dosis: number }[];
};

const n = (v: string | null) => (v === null ? null : Number(v));

/** Recetas (de todas las campañas), de la más nueva a la más vieja. */
export async function listarRecetas(filtro?: { id?: number }): Promise<Receta[]> {
  if (modoDemo()) return [];
  const filas = await db
    .select({ receta: recetas, loteId: ciclos.loteId })
    .from(recetas)
    .innerJoin(ciclos, eq(recetas.cicloId, ciclos.id))
    .where(filtro?.id !== undefined ? eq(recetas.id, filtro.id) : undefined)
    .orderBy(desc(recetas.numero));
  if (!filas.length) return [];

  const items = await db
    .select()
    .from(recetaItems)
    .where(
      inArray(
        recetaItems.recetaId,
        filas.map((f) => f.receta.id),
      ),
    )
    .orderBy(recetaItems.id);

  return filas.map(({ receta: r, loteId }) => ({
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    loteId,
    estado: r.estado,
    numeroOficial: r.numeroOficial,
    superficieHa: n(r.superficieHa),
    plagaObjetivo: r.plagaObjetivo,
    tipoAplicacion: r.tipoAplicacion,
    caudalLHa: n(r.caudalLHa),
    fechaAplicacionPrevista: r.fechaAplicacionPrevista,
    condiciones: r.condiciones,
    recomendaciones: r.recomendaciones,
    observaciones: r.observaciones,
    extras: r.extras,
    items: items
      .filter((i) => i.recetaId === r.id)
      .map((i) => ({ productoId: i.productoId, dosis: Number(i.dosisPorHa) })),
  }));
}

export async function recetaPorId(id: number) {
  const [receta] = await listarRecetas({ id });
  return receta ?? null;
}

/** Receta con lote, campo, productor y productos resueltos, lista para mostrar o imprimir. */
export async function recetaDetallada(id: number) {
  const receta = await recetaPorId(id);
  if (!receta) return null;
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === receta.loteId);
  const campo = datos.campos.find((c) => c.id === lote?.campoId);
  const productor = datos.productores?.find((p) => p.id === campo?.productorId);
  const ha = receta.superficieHa ?? lote?.ha ?? 0;
  return {
    receta,
    lote,
    campo,
    productor,
    ha,
    personalizados: (datos.camposPersonalizados ?? []).filter((c) => c.entidad === "receta"),
    productos: receta.items.map((i) => {
      const p = datos.productos.find((x) => x.id === i.productoId);
      return {
        nombre: p?.nombre ?? "Insumo",
        principioActivo: p?.principioActivo ?? null,
        concentracion: p?.concentracion ?? null,
        bandaToxicologica: p?.bandaToxicologica ?? null,
        carenciaDias: p?.carenciaDias ?? null,
        unidad: p?.unidad ?? "",
        dosis: i.dosis,
        total: i.dosis * ha,
      };
    }),
  };
}

// ─── Datos del ingeniero (para los PDF) ─────────────────────────────────────

export const CLAVES_INGENIERO = ["ingeniero_nombre", "ingeniero_matricula", "ingeniero_telefono", "ingeniero_email"] as const;
export type DatosIngeniero = Record<(typeof CLAVES_INGENIERO)[number], string>;

export async function datosIngeniero(): Promise<DatosIngeniero> {
  const vacio = Object.fromEntries(CLAVES_INGENIERO.map((c) => [c, ""])) as DatosIngeniero;
  if (modoDemo()) return vacio;
  const filas = await db
    .select()
    .from(configuracion)
    .where(inArray(configuracion.clave, [...CLAVES_INGENIERO]));
  for (const f of filas) vacio[f.clave as keyof DatosIngeniero] = f.valor;
  return vacio;
}
