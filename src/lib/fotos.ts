import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { fotos } from "@/db/schema";
import { modoDemo } from "./modo-demo";
import { fotosConfiguradas, urlsFirmadas } from "./almacenamiento";

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
  const urls = await urlsFirmadas(filas.map((f) => f.ruta));
  for (const c of conMapa) {
    const f = filas.find((x) => x.id === c.fotoMapaId);
    const url = f && urls.get(f.ruta);
    // Sin medidas no se puede respetar la proporción: se asume 4:3.
    if (f && url) mapas.set(c.id, { id: f.id, url, ancho: f.ancho ?? 1600, alto: f.alto ?? 1200 });
  }
  return mapas;
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

  const urls = await urlsFirmadas(filas.map((f) => f.ruta));
  return {
    disponible: true,
    fotos: filas
      .filter((f) => urls.has(f.ruta))
      .map((f) => ({ id: f.id, url: urls.get(f.ruta)!, fecha: f.fecha, nota: f.nota, ancho: f.ancho, alto: f.alto })),
  };
}
