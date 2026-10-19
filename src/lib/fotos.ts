import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { fotos, type Dibujo } from "@/db/schema";
import type { Campo, Lote } from "./datos";
import { modoDemo } from "./modo-demo";
import { fotosConfiguradas, mensajeAlmacenamiento, urlsFirmadas } from "./almacenamiento";

export type Destino = { tipo: "campo" | "lote"; id: number };

export type Foto = {
  id: number;
  url: string;
  fecha: string;
  nota: string | null;
  ancho: number | null;
  alto: number | null;
  esMapa: boolean;
};

/**
 * Foto sobre la que se marcan lotes. Un campo puede tener varios mapas (lotes lejos entre sí,
 * o una foto por lote); cada lote dice sobre cuál está marcado (`Lote.mapaId`).
 */
export type FotoMapa = { id: number; campoId: number; url: string; ancho: number; alto: number };

/** Mapas de esos campos, en el orden en que se cargaron. */
export async function mapasDeCampos(campoIds: number[]): Promise<FotoMapa[]> {
  if (modoDemo() || !fotosConfiguradas() || !campoIds.length) return [];

  const filas = await db
    .select()
    .from(fotos)
    .where(and(inArray(fotos.campoId, campoIds), eq(fotos.esMapa, true)))
    .orderBy(asc(fotos.id));
  // Si el almacenamiento falla (variables mal cargadas), las pantallas siguen sin el mapa.
  const urls = await urlsFirmadas(filas.map((f) => f.ruta)).catch((error) => {
    console.error("[fotos]", mensajeAlmacenamiento(error));
    return new Map<string, string>();
  });
  return filas
    .filter((f) => urls.has(f.ruta))
    // Sin medidas no se puede respetar la proporción: se asume 4:3.
    .map((f) => ({ id: f.id, campoId: f.campoId!, url: urls.get(f.ruta)!, ancho: f.ancho ?? 1600, alto: f.alto ?? 1200 }));
}

/** Si la foto es uno de los mapas del campo (para validar dónde se marca un lote). */
export async function esMapaDelCampo(mapaId: number, campoId: number) {
  const [mapa] = await db
    .select({ id: fotos.id })
    .from(fotos)
    .where(and(eq(fotos.id, mapaId), eq(fotos.campoId, campoId), eq(fotos.esMapa, true)));
  return Boolean(mapa);
}

/** Mapa listo para dibujar (PDF): la foto y los lotes marcados sobre ella. */
export type MapaConLotes = {
  campo: string;
  foto: FotoMapa;
  lotes: { id: number; codigo: string; nombre: string; cultivo: string; dibujo: Dibujo }[];
};

const marcadosEn = (foto: FotoMapa, lotes: Lote[]) =>
  lotes
    .filter((l) => l.mapaId === foto.id && l.dibujo)
    .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo! }));

/** Los mapas del campo que tienen algún lote marcado, cada uno con sus lotes. */
export async function mapasConLotes(campo: Campo, lotes: Lote[]): Promise<MapaConLotes[]> {
  return (await mapasDeCampos([campo.id]))
    .map((foto) => ({ campo: campo.nombre, foto, lotes: marcadosEn(foto, lotes) }))
    .filter((m) => m.lotes.length > 0);
}

/** El mapa donde está marcado el lote (con los demás lotes de esa foto), o null si no está marcado. */
export async function mapaDelLote(lote: Lote, campo: Campo | undefined, lotes: Lote[]): Promise<MapaConLotes | null> {
  if (!campo || !lote.mapaId || !lote.dibujo) return null;
  const foto = (await mapasDeCampos([campo.id])).find((f) => f.id === lote.mapaId);
  return foto ? { campo: campo.nombre, foto, lotes: marcadosEn(foto, lotes) } : null;
}

/** Estado de la galería: si se pueden usar las fotos y las que hay, de la más nueva a la más vieja. */
export async function fotosDe(destino: Destino): Promise<{ disponible: boolean; motivo?: string; fotos: Foto[] }> {
  if (modoDemo()) return { disponible: false, motivo: "En el modo demo no se pueden cargar fotos.", fotos: [] };
  if (!fotosConfiguradas())
    return {
      disponible: false,
      motivo: "Falta configurar el almacenamiento (SUPABASE_URL y SUPABASE_SECRET_KEY).",
      fotos: [],
    };

  const filas = await db
    .select()
    .from(fotos)
    .where(destino.tipo === "campo" ? eq(fotos.campoId, destino.id) : eq(fotos.loteId, destino.id))
    .orderBy(desc(fotos.fecha), desc(fotos.id));

  let urls: Map<string, string>;
  try {
    urls = await urlsFirmadas(filas.map((f) => f.ruta));
  } catch (error) {
    return { disponible: false, motivo: mensajeAlmacenamiento(error), fotos: [] };
  }
  return {
    disponible: true,
    fotos: filas
      .filter((f) => urls.has(f.ruta))
      .map((f) => ({ id: f.id, url: urls.get(f.ruta)!, fecha: f.fecha, nota: f.nota, ancho: f.ancho, alto: f.alto, esMapa: f.esMapa })),
  };
}
