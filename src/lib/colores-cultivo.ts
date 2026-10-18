/**
 * Color de cada cultivo para pintar los lotes sobre la foto del campo (mapa y PDF).
 * Saturados para que se vean sobre una foto aérea.
 */
const COLORES: Record<string, string> = {
  soja: "#3c9a3c",
  maiz: "#f2c200",
  "maíz": "#f2c200",
  trigo: "#c99a3a",
  girasol: "#f08c00",
  sorgo: "#b5562b",
  cebada: "#8fbf3a",
};

export const COLOR_SIN_CULTIVO = "#8a8f9c";

/** "Trigo/Soja" → el del último (el que está en el lote ahora, en un doble cultivo). */
export function colorCultivo(cultivo: string | null | undefined) {
  const ultimo = (cultivo ?? "").split("/").pop()?.trim().toLowerCase();
  if (!ultimo || ultimo === "sin definir") return COLOR_SIN_CULTIVO;
  return COLORES[ultimo] ?? "#0b63ae";
}
