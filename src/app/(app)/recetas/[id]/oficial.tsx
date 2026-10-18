"use client";

import { useState, useTransition } from "react";
import { FileCheck, FileUp } from "lucide-react";
import { quitarRecetaOficial, subirRecetaOficial } from "../acciones";

/** Estado del PDF de la receta oficial de la provincia: subirlo, reemplazarlo o quitarlo. */
export function RecetaOficial({ recetaId, cargada }: { recetaId: number; cargada: boolean }) {
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (archivo.type !== "application/pdf") return setError("El archivo tiene que ser un PDF.");
    setError("");
    iniciar(async () => {
      const datos = new FormData();
      datos.set("recetaId", String(recetaId));
      datos.set("archivo", archivo);
      const r = await subirRecetaOficial(datos);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
      <p className="flex items-center gap-2 font-bold">
        {cargada ? (
          <FileCheck className="text-positivo size-5" aria-hidden />
        ) : (
          <FileUp className="text-muted-foreground size-5" aria-hidden />
        )}
        {cargada ? "Receta oficial cargada" : "Sin la receta oficial de la provincia"}
      </p>
      <p className="text-muted-foreground text-xs">
        {cargada
          ? "Al descargar el PDF salen las dos hojas juntas: el resumen y la receta oficial."
          : "Subí el PDF de la receta oficial y se exporta junto con el resumen."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="bg-card hover:bg-muted flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <FileUp className="size-4" aria-hidden />
          {ocupado ? "Subiendo…" : cargada ? "Reemplazar PDF" : "Subir PDF oficial"}
          <input type="file" accept="application/pdf" onChange={subir} className="sr-only" disabled={ocupado} />
        </label>
        {cargada && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              if (!window.confirm("¿Quitar el PDF de la receta oficial?")) return;
              iniciar(async () => {
                const r = await quitarRecetaOficial(recetaId);
                if (!r.ok) setError(r.error);
              });
            }}
            className="text-destructive text-sm font-bold disabled:opacity-50"
          >
            Quitar
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
