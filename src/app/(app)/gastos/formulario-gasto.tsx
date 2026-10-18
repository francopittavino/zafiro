"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { Campo, Catalogo, Gasto, Lote } from "@/lib/datos";
import { BotonAlta, Pie, entrada, etiqueta, useEnvio } from "@/components/app/altas";
import { fechaCorta, hoyIso, leerNumero, numeroEditable, usd2 } from "@/lib/formato";
import { eliminarGasto, guardarGasto } from "./acciones";

type Opciones = { campos: Campo[]; lotes: Lote[]; categorias: Catalogo[] };

export function FormGasto({
  campos,
  lotes,
  categorias,
  inicial,
  alGuardar,
}: Opciones & { inicial?: Gasto | Partial<Gasto>; alGuardar: (id?: number) => void }) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const valorInicial = inicial?.loteId ? `lote:${inicial.loteId}` : inicial?.campoId ? `campo:${inicial.campoId}` : "general";
  const [destino, setDestino] = useState(valorInicial);
  const editando = inicial && "id" in inicial && inicial.id !== undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const importe = leerNumero(String(f.get("importe")));
        if (!(importe >= 0)) return setError("Escribí un importe válido (ej. 1500 o 1.500,50).");
        const [tipo, id] = destino.split(":");
        enviar(() =>
          guardarGasto(
            {
              destino: { tipo: tipo as "lote" | "campo" | "general", id: id ? Number(id) : undefined },
              categoriaId: Number(f.get("categoriaId")),
              fecha: String(f.get("fecha")),
              descripcion: String(f.get("descripcion") ?? ""),
              importe,
            },
            editando ? (inicial as Gasto).id : undefined,
          ),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Se carga a *
        <select className={entrada} value={destino} onChange={(e) => setDestino(e.target.value)} required>
          <option value="general">Toda la campaña (general)</option>
          <optgroup label="Un campo entero (se reparte por ha entre sus lotes)">
            {campos.map((c) => (
              <option key={c.id} value={`campo:${c.id}`}>
                Campo {c.nombre}
              </option>
            ))}
          </optgroup>
          {campos.map((c) => (
            <optgroup key={c.id} label={`Lotes de ${c.nombre}`}>
              {lotes
                .filter((l) => l.campoId === c.id)
                .map((l) => (
                  <option key={l.id} value={`lote:${l.id}`}>
                    {l.codigo} · {l.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Categoría *
          <select name="categoriaId" className={entrada} defaultValue={inicial?.categoriaId ?? ""} required>
            <option value="" disabled>
              Elegí…
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Fecha *
          <input name="fecha" type="date" className={entrada} defaultValue={inicial?.fecha ?? hoyIso()} required />
        </label>
      </div>
      <label className={etiqueta}>
        Importe USD *
        <input
          name="importe"
          className={entrada}
          inputMode="decimal"
          defaultValue={inicial?.importe !== undefined ? numeroEditable(inicial.importe) : ""}
          required
        />
      </label>
      <label className={etiqueta}>
        Detalle
        <input name="descripcion" className={entrada} defaultValue={inicial?.descripcion ?? ""} placeholder="Opcional" />
      </label>
      <p className="text-muted-foreground text-xs">
        Las categorías se agregan en Más → Ajustes.
      </p>
      <Pie error={error} guardando={guardando} texto={editando ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

export function BotonNuevoGasto(props: Opciones & { inicial?: Partial<Gasto>; texto?: string }) {
  return (
    <BotonAlta
      texto={props.texto ?? "+ Gasto"}
      titulo="Nuevo gasto"
      formulario={(listo) => <FormGasto {...props} alGuardar={listo} />}
    />
  );
}

/** Fila de la lista con editar y borrar. */
export function FilaGasto({ gasto, destino, ...opciones }: Opciones & { gasto: Gasto; destino: string }) {
  const [borrando, iniciar] = useTransition();
  const [error, setError] = useState("");
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground w-14 shrink-0 text-xs">{fechaCorta(gasto.fecha)}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{gasto.categoria}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {destino}
          {gasto.descripcion && ` · ${gasto.descripcion}`}
        </span>
        {error && <span className="text-destructive block text-xs">{error}</span>}
      </span>
      <span className="font-bold tabular-nums">{usd2(gasto.importe)}</span>
      <BotonAlta
        texto="Editar"
        titulo="Editar gasto"
        variante="secundario"
        formulario={(listo) => <FormGasto {...opciones} inicial={gasto} alGuardar={listo} />}
      />
      <button
        type="button"
        disabled={borrando}
        onClick={() =>
          iniciar(async () => {
            const r = await eliminarGasto(gasto.id);
            if (!r.ok) setError(r.error);
          })
        }
        aria-label="Eliminar gasto"
        className="text-muted-foreground hover:bg-muted hover:text-destructive flex size-10 items-center justify-center rounded-lg"
      >
        <Trash2 className="size-[18px]" aria-hidden />
      </button>
    </li>
  );
}
