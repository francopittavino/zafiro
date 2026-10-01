"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Ventana modal con el <dialog> nativo (foco, Escape y fondo los maneja el navegador).
 * En el celular se abre como hoja desde abajo; en la PC, centrada.
 */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      aria-labelledby="dialogo-titulo"
      className="bg-card text-foreground m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl p-0 shadow-xl backdrop:bg-black/40 md:m-auto md:max-w-lg md:rounded-2xl"
    >
      {abierto && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 id="dialogo-titulo" className="text-lg font-black">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar"
              className="hover:bg-muted -mr-2 flex size-11 items-center justify-center rounded-lg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
