"use client";

/** Abre la impresión del navegador; desde ahí se elige "Guardar como PDF". */
export function BotonImprimir({ texto = "PDF" }: { texto?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-card hover:bg-muted h-10 rounded-lg border px-3 text-sm font-bold"
    >
      {texto}
    </button>
  );
}
