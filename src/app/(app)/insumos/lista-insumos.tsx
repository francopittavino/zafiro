"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { PrecioHistorico, Producto } from "@/lib/datos";
import { NOMBRE_CATEGORIA, fechaCorta, hoyIso, leerNumero, usd2 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { agregarPrecio } from "./acciones";

export function ListaInsumos({
  productos,
  historial,
}: {
  productos: Producto[];
  historial: Record<number, PrecioHistorico[]>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);

  const categorias = Object.keys(NOMBRE_CATEGORIA).filter((c) => productos.some((p) => p.categoria === c));
  const q = busqueda.trim().toLowerCase();
  const visibles = productos.filter(
    (p) => (!categoria || p.categoria === categoria) && (!q || p.nombre.toLowerCase().includes(q)),
  );

  return (
    <div className="flex flex-col gap-3 p-4 md:p-0">
      <label className="bg-card text-muted-foreground flex h-11 items-center gap-2 rounded-lg border px-3 md:max-w-sm">
        <Search className="size-[18px]" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar insumo"
          aria-label="Buscar insumo"
          className="text-foreground flex-1 bg-transparent outline-none"
        />
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filtrar por tipo">
        {["", ...categorias].map((c) => (
          <button
            key={c || "todos"}
            type="button"
            onClick={() => setCategoria(c)}
            aria-pressed={categoria === c}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-bold",
              categoria === c ? "bg-primary text-primary-foreground border-primary" : "bg-card",
            )}
          >
            {c ? NOMBRE_CATEGORIA[c] : "Todos"}
          </button>
        ))}
      </div>

      <ul className="bg-card divide-y rounded-xl border md:grid md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li:nth-child(odd)]:border-r">
        {visibles.map((p) => (
          <li key={p.id} className={cn(abierto === p.id && "bg-zafiro-suave/50")}>
            <button
              type="button"
              onClick={() => setAbierto(abierto === p.id ? null : p.id)}
              aria-expanded={abierto === p.id}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block font-bold">{p.nombre}</span>
                <span className="text-muted-foreground block text-xs">
                  {NOMBRE_CATEGORIA[p.categoria]} · {p.unidad}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-bold tabular-nums">{usd2(p.precio)}</span>
                <span className="text-muted-foreground block text-xs">USD/{p.unidad}</span>
              </span>
            </button>
            {abierto === p.id && <DetallePrecios producto={p} precios={historial[p.id] ?? []} />}
          </li>
        ))}
      </ul>
      {visibles.length === 0 && <p className="text-muted-foreground text-sm">No hay insumos que coincidan.</p>}
    </div>
  );
}

const entrada =
  "bg-card h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/30";

function DetallePrecios({ producto, precios }: { producto: Producto; precios: PrecioHistorico[] }) {
  const [cargando, setCargando] = useState(false);
  const [precio, setPrecio] = useState("");
  const [fecha, setFecha] = useState(hoyIso);
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null);
  const [guardando, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const valor = leerNumero(precio);
    if (!(valor >= 0)) {
      setMensaje({ error: true, texto: "Escribí un precio válido (ej. 5,75)." });
      return;
    }
    if (!fecha) {
      setMensaje({ error: true, texto: "Completá la fecha." });
      return;
    }
    iniciar(async () => {
      const resultado = await agregarPrecio(producto.id, valor, fecha);
      if (!resultado.ok) {
        setMensaje({ error: true, texto: resultado.error });
        return;
      }
      setMensaje({
        error: false,
        texto: resultado.demo ? "Modo demo: el precio no se guardó." : `Precio guardado: ${usd2(valor)} USD/${producto.unidad}.`,
      });
      setCargando(false);
      setPrecio("");
    });
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="text-muted-foreground text-xs">
        <p className="font-bold tracking-wider uppercase">Historial de precios</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {precios.map((h, i) => (
            <li key={`${h.fecha}-${i}`} className="flex justify-between">
              <span>
                {h.fecha ? fechaCorta(h.fecha) : "Importado de la planilla"}
                {i === 0 && precios.length > 1 && <span className="text-zafiro font-bold"> · vigente</span>}
              </span>
              <span className="text-foreground tabular-nums">{usd2(h.precio)}</span>
            </li>
          ))}
        </ul>
      </div>

      {mensaje && (
        <p
          role={mensaje.error ? "alert" : "status"}
          className={cn("text-sm", mensaje.error ? "text-destructive" : "text-positivo font-bold")}
        >
          {mensaje.texto}
        </p>
      )}

      {cargando ? (
        <form onSubmit={guardar} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold">
              Precio USD/{producto.unidad} *
              <input
                className={entrada}
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder={usd2(producto.precio)}
                autoFocus
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">
              Vigente desde *
              <input type="date" className={entrada} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
          </div>
          <p className="text-muted-foreground text-xs">
            Las labores ya cargadas no cambian: guardan el precio del momento.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCargando(false);
                setMensaje(null);
              }}
              className="bg-card hover:bg-muted h-11 rounded-lg border text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="bg-primary text-primary-foreground h-11 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar precio"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCargando(true);
            setMensaje(null);
          }}
          className="bg-primary text-primary-foreground h-11 rounded-lg text-sm font-bold"
        >
          Nuevo precio
        </button>
      )}
    </div>
  );
}
