import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
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
};

/** Foto sobre la que se marcan los lotes de un campo. */
export type FotoMapa = { id: number; url: string; ancho: number; alto: number };

/** Fotos de mapa de los campos que tienen una elegida (campoId → foto). */
export async function mapasDeCampos(campos: { id: number; fotoMapaId?: number | null }[]) {
  const mapas = new Map<number, FotoMapa>();
  const conMapa = campos.filter((c) => c.fotoMapaId);
  if (modoDemo() || !fotosConfiguradas() || !conMapa.length) return mapas;

  const filas = await db
    .select()
    .from(fotos)
    .where(inArray(fotos.id, conMapa.map((c) => c.fotoMapaId!)));
  // Si el almacenamiento falla (variables mal cargadas), las pantallas siguen sin el mapa.
  const urls = await urlsFirmadas(filas.map((f) => f.ruta)).catch((error) => {
    console.error("[fotos]", mensajeAlmacenamiento(error));
    return new Map<string, string>();
  });
  for (const c of conMapa) {
    const f = filas.find((x) => x.id === c.fotoMapaId);
    const url = f && urls.get(f.ruta);
    // Sin medidas no se puede respetar la proporción: se asume 4:3.
    if (f && url) mapas.set(c.id, { id: f.id, url, ancho: f.ancho ?? 1600, alto: f.alto ?? 1200 });
  }
  return mapas;
}

/** Mapa de un campo listo para dibujar (PDF): la foto y los lotes marcados sobre ella. */
export type MapaConLotes = {
  campo: string;
  foto: FotoMapa;
  lotes: { id: number; codigo: string; nombre: string; cultivo: string; dibujo: Dibujo }[];
};

/** Mapa del campo con sus lotes marcados, o null si no tiene foto o ningún lote marcado. */
export async function mapaConLotes(campo: Campo, lotes: Lote[]): Promise<MapaConLotes | null> {
  const foto = (await mapasDeCampos([campo])).get(campo.id);
  const marcados = lotes
    .filter((l) => l.campoId === campo.id && l.dibujo)
    .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo! }));
  return foto && marcados.length ? { campo: campo.nombre, foto, lotes: marcados } : null;
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
      .map((f) => ({ id: f.id, url: urls.get(f.ruta)!, fecha: f.fecha, nota: f.nota, ancho: f.ancho, alto: f.alto })),
  };
}
