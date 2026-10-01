import "server-only";
import { desc, eq } from "drizzle-orm";
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
