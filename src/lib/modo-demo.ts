/**
 * Modo demo: permite recorrer la app en local sin base de datos ni PIN, con los
 * datos de prueba de `datos-demo/zafiro.json` (ver scripts/importar-planilla.py).
 *
 * Solo se activa con `next dev` (NODE_ENV=development) y `ZAFIRO_DEMO=1`;
 * en un build de producción (Vercel) es imposible activarlo.
 */
export const modoDemo = () =>
  process.env.NODE_ENV === "development" && process.env.ZAFIRO_DEMO === "1";
