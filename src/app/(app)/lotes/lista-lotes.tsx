"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Campo, Lote } from "@/lib/datos";
import { usd } from "@/lib/formato";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { cn } from "@/lib/utils";

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ListaLotes({ campos, lotes }: { campos: Campo[]; lotes: Lote[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [abiertos, setAbiertos] = useState<Set<number>>(() => new Set(campos.slice(0, 1).map((c) => c.id)));

  const q = normalizar(busqueda.trim());
  const coincide = (l: Lote, campo: Campo) =>
    !q || normalizar(`${l.codigo} ${l.nombre} ${campo.nombre} ${l.cultivo}`).includes(q);

  const alternar = (id: number) =>
    setAbiertos((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  return (
    <div className="flex flex-col gap-3 p-4 md:p-0">
      <label className="bg-card text-muted-foreground flex h-11 items-center gap-2 rounded-lg border px-3 md:max-w-sm">
        <Search className="size-[18px]" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar lote, código o cultivo"
          aria-label="Buscar lote"
          className="text-foreground flex-1 bg-transparent outline-none"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        {campos.map((campo) => {
          const delCampo = lotes.filter((l) => l.campoId === campo.id);
          const visibles = delCampo.filter((l) => coincide(l, campo));
          if (visibles.length === 0) return null;
          const abierto = q !== "" || abiertos.has(campo.id);
          const ha = delCampo.reduce((t, l) => t + l.ha, 0);

          return (
            <section key={campo.id} className="bg-card overflow-hidden rounded-xl border">
              <button
                type="button"
                onClick={() => alternar(campo.id)}
                aria-expanded={abierto}
                className={cn("flex w-full items-center justify-between px-4 py-3 text-left", abierto && "bg-zafiro-suave")}
              >
                <span>
                  <span className="block font-bold">{campo.nombre}</span>
                  <span className="text-muted-foreground block text-xs">
                    {delCampo.length} {delCampo.length === 1 ? "lote" : "lotes"} · {usd(ha)} ha
                  </span>
                </span>
                <ChevronDown
                  className={cn("text-muted-foreground size-5 transition-transform", abierto && "rotate-180")}
                  aria-hidden
                />
              </button>
              {abierto && (
                <ul className="divide-y border-t">
                  {visibles.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/lotes/${l.id}`}
                        className="hover:bg-muted/60 grid grid-cols-[56px_1fr_auto] items-center gap-2 px-4 py-3"
                      >
                        <span className="text-zafiro text-xs font-black">{l.codigo}</span>
                        <span>
                          <span className="block font-bold">{l.nombre}</span>
                          <span className="text-muted-foreground block text-xs">{usd(l.ha)} ha</span>
                        </span>
                        <ChipCultivo cultivo={l.cultivo} />
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href={`/campos/${campo.id}`}
                      className="text-zafiro hover:bg-muted/60 flex h-11 items-center justify-center text-sm font-bold"
                    >
                      Ver campo y fotos →
                    </Link>
                  </li>
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
