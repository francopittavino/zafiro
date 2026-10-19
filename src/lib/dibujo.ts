import type { Dibujo } from "@/db/schema";

/** Figura dibujada sobre la foto del campo: entre 3 y 500 puntos [x, y], cada valor entre 0 y 1. */
export function dibujoValido(dibujo: unknown): dibujo is Dibujo {
  return (
    Array.isArray(dibujo) &&
    dibujo.length >= 3 &&
    dibujo.length <= 500 &&
    dibujo.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1),
    )
  );
}

/** Puntos de la figura en el formato del atributo `points` de un <polygon> SVG (viewBox 0..100). */
export const puntosSvg = (dibujo: Dibujo) => dibujo.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");

/** Centro aproximado (promedio de los puntos), para poner la etiqueta. */
export function centro(dibujo: Dibujo): [number, number] {
  const [sx, sy] = dibujo.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sx / dibujo.length, sy / dibujo.length];
}

/**
 * Lotes marcados sobre ese mapa (foto del campo). Va acá y no en el componente del mapa
 * porque ese es "use client": sus funciones no se pueden llamar desde una página del servidor.
 */
export const lotesEn = <T extends { dibujo?: Dibujo | null; mapaId?: number | null }>(lotes: T[], mapaId: number | undefined) =>
  lotes.filter((l) => l.dibujo && l.mapaId === mapaId);
