"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { Catalogo, CampoPersonalizado, EntidadPersonalizable } from "@/lib/datos";
import { entrada } from "@/components/app/altas";
import {
  crearCampoPersonalizado,
  crearEnLista,
  quitarCampoPersonalizado,
  quitarDeLista,
  type ListaSimple,
  type ResultadoAlta,
} from "../acciones-catalogos";

/** Agregar y quitar elementos de una lista corta, en el lugar (sin ventanas). */
function Editor({
  elementos,
  placeholder,
  agregar,
  quitar,
  extra,
}: {
  elementos: { id: number; texto: string; detalle?: string }[];
  placeholder: string;
  agregar: (nombre: string, extra: string) => Promise<ResultadoAlta>;
  quitar: (id: number) => Promise<ResultadoAlta>;
  /** Selector opcional al lado del nombre (ej. tipo de dato). */
  extra?: { opciones: [string, string][]; etiqueta: string };
}) {
  const [nombre, setNombre] = useState("");
  const [valorExtra, setValorExtra] = useState(extra?.opciones[0][0] ?? "");
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();

  const ejecutar = (accion: () => Promise<ResultadoAlta>, alTerminar?: () => void) =>
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
      else {
        setError("");
        alTerminar?.();
      }
    });

  return (
    <div className="flex flex-col gap-2">
      {elementos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {elementos.map((e) => (
            <li key={e.id} className="bg-muted flex h-9 items-center gap-1 rounded-full pr-1 pl-3 text-sm">
              {e.texto}
              {e.detalle && <span className="text-muted-foreground text-xs">· {e.detalle}</span>}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => ejecutar(() => quitar(e.id))}
                aria-label={`Quitar ${e.texto}`}
                className="hover:bg-card hover:text-destructive flex size-7 items-center justify-center rounded-full"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) ejecutar(() => agregar(nombre, valorExtra), () => setNombre(""));
        }}
        className="flex gap-2"
      >
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={entrada}
        />
        {extra && (
          <select
            value={valorExtra}
            onChange={(e) => setValorExtra(e.target.value)}
            aria-label={extra.etiqueta}
            className={`${entrada} w-28 shrink-0`}
          >
            {extra.opciones.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={ocupado || !nombre.trim()}
          className="bg-primary text-primary-foreground h-11 shrink-0 rounded-lg px-4 text-sm font-bold disabled:opacity-50"
        >
          Agregar
        </button>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

const TIPOS: [string, string][] = [
  ["texto", "Texto"],
  ["numero", "Número"],
  ["fecha", "Fecha"],
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS);

export function EditorCamposPersonalizados({
  entidad,
  campos,
}: {
  entidad: EntidadPersonalizable;
  campos: CampoPersonalizado[];
}) {
  return (
    <Editor
      elementos={campos
        .filter((c) => c.entidad === entidad)
        .map((c) => ({ id: c.id, texto: c.nombre, detalle: NOMBRE_TIPO[c.tipo] }))}
      placeholder="Nuevo dato (ej. Napa)"
      agregar={(nombre, tipo) => crearCampoPersonalizado({ entidad, nombre, tipo })}
      quitar={quitarCampoPersonalizado}
      extra={{ opciones: TIPOS, etiqueta: "Tipo de dato" }}
    />
  );
}

export function EditorLista({
  lista,
  elementos,
  placeholder,
}: {
  lista: ListaSimple;
  elementos: Catalogo[];
  placeholder: string;
}) {
  return (
    <Editor
      elementos={elementos.map((e) => ({ id: e.id, texto: e.nombre }))}
      placeholder={placeholder}
      agregar={(nombre) => crearEnLista(lista, { nombre })}
      quitar={(id) => quitarDeLista(lista, id)}
    />
  );
}
