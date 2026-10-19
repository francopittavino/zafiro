"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cambiarEstadoOrden, eliminarOrden } from "../acciones";

/** "Marcar como enviada" después de mandar el PDF (no hay forma de saberlo sola). */
export function BotonEnviada({ id }: { id: number }) {
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={guardando}
        onClick={() =>
          iniciar(async () => {
            const r = await cambiarEstadoOrden(id, "enviada");
            if (!r.ok) setError(r.error);
          })
        }
        className="bg-card hover:bg-muted h-12 rounded-xl border text-sm font-bold disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Ya la mandé al productor"}
      </button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </>
  );
}

/** Pide confirmación en la misma pantalla (sin diálogos del navegador). */
export function BotonEliminarOrden({ id }: { id: number }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const [borrando, iniciar] = useTransition();

  if (!confirmando)
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-destructive hover:bg-muted h-11 rounded-xl text-sm font-bold"
      >
        Eliminar orden
      </button>
    );

  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <p>¿Eliminar la orden? No se puede deshacer (si ya se mandó, conviene marcarla como anulada). La labor registrada, si hay, queda.</p>
      {error && <p className="text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirmando(false)} className="bg-card h-10 rounded-lg border font-bold">
          Cancelar
        </button>
        <button
          type="button"
          disabled={borrando}
          onClick={() =>
            iniciar(async () => {
              const r = await eliminarOrden(id);
              if (r.ok) router.push("/ordenes");
              else setError(r.error);
            })
          }
          className="bg-destructive h-10 rounded-lg font-bold text-white disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
