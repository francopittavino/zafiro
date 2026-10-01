"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, Download, Pencil, Search, Trash2 } from "lucide-react";
import type { LaborDetalle } from "@/lib/consultas";
import { fechaCorta, mesAnio, num, usd, usd2 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { eliminarLabor } from "../registrar/acciones";

const filtroSelect = "bg-card h-10 rounded-lg border border-input px-2 text-sm";

function descargarCsv(labores: LaborDetalle[]) {
  const filas = [["Fecha", "Campo", "Lote", "Cultivo", "Labor", "Ha", "Producto", "Dosis/ha", "Precio USD", "Insumos USD", "Labor USD", "Total USD", "Aporte"]];
  for (const l of labores) {
    const base = [l.fecha, l.campo, `${l.lote.codigo} ${l.lote.nombre}`, l.lote.cultivo, l.tipo, num(l.ha)];
    const productos = l.productos.length ? l.productos : [null];
    productos.forEach((p, i) =>
      filas.push([
        ...base,
        p?.nombre ?? "",
        p ? num(p.dosis, 4) : "",
        p ? num(p.precio, 4) : "",
        p ? num(p.dosis * p.precio * l.ha) : "",
        i === 0 ? num(l.costo.trabajo) : "",
        i === 0 ? num(l.costo.total) : "",
        l.aporte ?? "",
      ]),
    );
  }
  // Punto y coma + BOM: es lo que espera el Excel en español.
  const csv = "﻿" + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  enlace.download = "zafiro-historial.csv";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export function ListaHistorial({ labores, campos }: { labores: LaborDetalle[]; campos: string[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [campo, setCampo] = useState("");
  const [tipo, setTipo] = useState("");
  const [abierta, setAbierta] = useState<number | null>(null);

  const tipos = useMemo(() => [...new Set(labores.map((l) => l.tipo))].sort(), [labores]);
  const q = busqueda.trim().toLowerCase();
  const filtradas = labores.filter(
    (l) =>
      (!campo || l.campo === campo) &&
      (!tipo || l.tipo === tipo) &&
      (!q ||
        `${l.lote.codigo} ${l.lote.nombre} ${l.productos.map((p) => p.nombre).join(" ")}`.toLowerCase().includes(q)),
  );
  const total = filtradas.reduce((t, l) => t + l.costo.total, 0);

  // Agrupadas por mes para el celular.
  const porMes: [string, LaborDetalle[]][] = [];
  for (const l of filtradas) {
    const mes = mesAnio(l.fecha);
    const grupo = porMes.at(-1);
    if (grupo?.[0] === mes) grupo[1].push(l);
    else porMes.push([mes, [l]]);
  }

  return (
    <div className="flex flex-col gap-3 p-4 md:p-0">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <label className="bg-card text-muted-foreground flex h-10 items-center gap-2 rounded-lg border px-3 md:w-72">
          <Search className="size-4" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Lote o producto"
            aria-label="Buscar por lote o producto"
            className="text-foreground flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select aria-label="Campo" className={filtroSelect} value={campo} onChange={(e) => setCampo(e.target.value)}>
            <option value="">Todos los campos</option>
            {campos.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Labor" className={filtroSelect} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todas las labores</option>
            {tipos.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => descargarCsv(filtradas)}
          className="bg-card hover:bg-muted flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold md:ml-auto"
        >
          <Download className="size-4" aria-hidden />
          Exportar a Excel
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        {filtradas.length} labores · USD {usd(total)}
      </p>

      {/* Celular: tarjetas agrupadas por mes */}
      <div className="flex flex-col gap-2 md:hidden">
        {porMes.map(([mes, grupo]) => (
          <section key={mes} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground mt-2 text-xs font-bold tracking-wider uppercase">{mes}</h2>
            {grupo.map((l) => (
              <article
                key={l.id}
                className={cn("bg-card overflow-hidden rounded-xl border", abierta === l.id && "border-zafiro")}
              >
                <button
                  type="button"
                  onClick={() => setAbierta(abierta === l.id ? null : l.id)}
                  aria-expanded={abierta === l.id}
                  className="flex w-full flex-col gap-1 p-3 text-left"
                >
                  <span className="flex justify-between gap-2 font-bold">
                    <span>{l.tipo}</span>
                    <span className="tabular-nums">USD {usd2(l.costo.total)}</span>
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {fechaCorta(l.fecha)} · {l.lote.codigo} {l.lote.nombre} · {l.lote.cultivo} · {num(l.ha)} ha
                  </span>
                  {l.productos.length > 0 && (
                    <span className="text-sm">{l.productos.map((p) => p.nombre).join(", ")}</span>
                  )}
                </button>
                {abierta === l.id && <Acciones labor={l} />}
              </article>
            ))}
          </section>
        ))}
      </div>

      {/* PC: tabla */}
      <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
            <tr>
              <th className="px-4 py-3 font-bold">Fecha</th>
              <th className="px-2 py-3 font-bold">Campo</th>
              <th className="px-2 py-3 font-bold">Lote</th>
              <th className="px-2 py-3 font-bold">Labor</th>
              <th className="px-2 py-3 text-right font-bold">ha</th>
              <th className="px-2 py-3 font-bold">Productos</th>
              <th className="px-2 py-3 text-right font-bold">Insumos</th>
              <th className="px-2 py-3 text-right font-bold">Labor</th>
              <th className="px-4 py-3 text-right font-bold">Total USD</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {filtradas.map((l) => (
              <tr
                key={l.id}
                onClick={() => setAbierta(abierta === l.id ? null : l.id)}
                className={cn("hover:bg-muted/50 cursor-pointer align-top", abierta === l.id && "bg-zafiro-suave/60")}
              >
                <td className="px-4 py-2.5 whitespace-nowrap">{fechaCorta(l.fecha)}</td>
                <td className="px-2 py-2.5">{l.campo}</td>
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <span className="text-zafiro font-bold">{l.lote.codigo}</span> {l.lote.nombre}
                </td>
                <td className="px-2 py-2.5">{l.tipo}</td>
                <td className="px-2 py-2.5 text-right">{num(l.ha)}</td>
                <td className="text-muted-foreground max-w-64 px-2 py-2.5">
                  {abierta === l.id ? (
                    <ul>
                      {l.productos.map((p) => (
                        <li key={p.nombre}>
                          {p.nombre} · {num(p.dosis, 3)} {p.unidad}/ha × {usd2(p.precio)}
                        </li>
                      ))}
                      <li className="pt-2">
                        <Acciones labor={l} compacto />
                      </li>
                    </ul>
                  ) : (
                    <span className="line-clamp-1">{l.productos.map((p) => p.nombre).join(", ") || "—"}</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right">{usd2(l.costo.insumos)}</td>
                <td className="px-2 py-2.5 text-right">{usd2(l.costo.trabajo)}</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd2(l.costo.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Acciones({ labor, compacto = false }: { labor: LaborDetalle; compacto?: boolean }) {
  const [eliminando, iniciar] = useTransition();
  const eliminar = () => {
    const texto = `¿Eliminar ${labor.tipo} del ${fechaCorta(labor.fecha)} en ${labor.lote.codigo} ${labor.lote.nombre}? No se puede deshacer.`;
    if (!window.confirm(texto)) return;
    iniciar(async () => {
      const resultado = await eliminarLabor(labor.id);
      if (!resultado.ok) window.alert(resultado.error);
      else if (resultado.demo) window.alert("Modo demo: no se eliminó nada.");
    });
  };
  const clase = cn(
    "flex items-center justify-center gap-1.5 font-bold",
    compacto ? "h-8 rounded-md px-2 hover:bg-muted" : "h-11",
  );
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(compacto ? "flex gap-1 text-xs" : "grid grid-cols-3 border-t text-sm")}
    >
      <Link href={`/registrar?labor=${labor.id}`} className={cn(clase, "text-zafiro")}>
        <Pencil className="size-4" aria-hidden /> Editar
      </Link>
      <Link href={`/registrar?duplicar=${labor.id}`} className={cn(clase, "text-zafiro", !compacto && "border-l")}>
        <Copy className="size-4" aria-hidden /> Duplicar
      </Link>
      <button
        type="button"
        onClick={eliminar}
        disabled={eliminando}
        className={cn(clase, "text-destructive disabled:opacity-50", !compacto && "border-l")}
      >
        <Trash2 className="size-4" aria-hidden /> {eliminando ? "Eliminando…" : "Eliminar"}
      </button>
    </div>
  );
}
