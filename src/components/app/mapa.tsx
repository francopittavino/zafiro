"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Camera, Pencil, Undo2 } from "lucide-react";
import type { Dibujo } from "@/db/schema";
import type { Foto, FotoMapa } from "@/lib/fotos";
import { centro, puntosSvg } from "@/lib/dibujo";
import { colorCultivo } from "@/lib/colores-cultivo";
import { hoyIso } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { guardarDibujoLote, usarComoMapa } from "@/app/(app)/acciones-mapa";
import { subirFoto } from "@/app/(app)/acciones-fotos";
import { prepararFoto } from "./galeria-fotos";
import { entrada } from "./altas";

/**
 * Mapa propio sobre una foto del campo (sin GIS): los lotes y los manchones son
 * figuras con puntos relativos a la foto (0 a 1). El SVG va estirado encima de la
 * imagen (viewBox 0..100); las etiquetas son HTML para que no se deformen.
 */

export type LoteMapa = {
  id: number;
  codigo: string;
  nombre: string;
  cultivo: string;
  dibujo?: Dibujo | null;
  /** Mapa (foto) sobre el que está marcado `dibujo`. */
  mapaId?: number | null;
};

/** Lotes marcados sobre ese mapa. */
export const lotesEn = <T extends LoteMapa>(lotes: T[], mapaId: number | undefined) =>
  lotes.filter((l) => l.dibujo && l.mapaId === mapaId);

/** Nombre corto del mapa para elegirlo: "Mapa 2 · B1, B4". */
export function nombreMapa(mapas: FotoMapa[], mapaId: number, lotes: LoteMapa[]) {
  const codigos = lotesEn(lotes, mapaId).map((l) => l.codigo || l.nombre);
  const nombre = `Mapa ${mapas.findIndex((m) => m.id === mapaId) + 1}`;
  return codigos.length ? `${nombre} · ${codigos.join(", ")}` : nombre;
}

function Lienzo({
  foto,
  children,
  etiquetas,
  alTocar,
}: {
  foto: FotoMapa;
  children: React.ReactNode;
  etiquetas?: React.ReactNode;
  alTocar?: (punto: [number, number]) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  return (
    <div className="bg-muted relative w-full overflow-hidden rounded-xl border" style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}>
      <Image src={foto.url} alt="Foto del campo" fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      <svg
        ref={svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={cn("absolute inset-0 size-full", alTocar && "cursor-crosshair touch-none")}
        onPointerDown={
          alTocar &&
          ((e) => {
            const r = svg.current!.getBoundingClientRect();
            const limitar = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
            alTocar([limitar((e.clientX - r.left) / r.width), limitar((e.clientY - r.top) / r.height)]);
          })
        }
      >
        {children}
      </svg>
      {etiquetas}
    </div>
  );
}

/** Código del lote y, debajo, el cultivo de la campaña. */
function TextoLote({ lote }: { lote: LoteMapa }) {
  const cultivo = lote.cultivo.split("/").pop()?.trim();
  return (
    <>
      {lote.codigo || lote.nombre}
      {cultivo && <span className="block text-[9px] leading-tight font-bold opacity-80">{cultivo}</span>}
    </>
  );
}

function Etiqueta({ dibujo, texto, fuerte }: { dibujo: Dibujo; texto: React.ReactNode; fuerte?: boolean }) {
  const [x, y] = centro(dibujo);
  return (
    <span
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-center text-[11px] font-black whitespace-nowrap shadow",
        fuerte ? "bg-primary text-primary-foreground" : "bg-white/90 text-black",
      )}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {texto}
    </span>
  );
}

/** Lotes pintados según el cultivo; con `resaltado`, los demás quedan apagados. */
export function VistaMapa({
  foto,
  lotes,
  resaltado,
  zonas = [],
  conEnlaces = false,
}: {
  foto: FotoMapa;
  lotes: LoteMapa[];
  resaltado?: number;
  /** Manchones a mostrar encima (ej. de una labor). */
  zonas?: Dibujo[];
  conEnlaces?: boolean;
}) {
  const dibujados = lotes.filter((l) => l.dibujo);
  return (
    <Lienzo
      foto={foto}
      etiquetas={dibujados.map((l) =>
        conEnlaces ? (
          <Link
            key={l.id}
            href={`/lotes/${l.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-white/90 px-1.5 py-0.5 text-center text-[11px] font-black whitespace-nowrap text-black shadow"
            style={{ left: `${centro(l.dibujo!)[0] * 100}%`, top: `${centro(l.dibujo!)[1] * 100}%` }}
          >
            <TextoLote lote={l} />
          </Link>
        ) : (
          <Etiqueta key={l.id} dibujo={l.dibujo!} texto={<TextoLote lote={l} />} fuerte={l.id === resaltado} />
        ),
      )}
    >
      {dibujados.map((l) => (
        <polygon
          key={l.id}
          points={puntosSvg(l.dibujo!)}
          fill={colorCultivo(l.cultivo)}
          fillOpacity={resaltado === undefined || resaltado === l.id ? 0.45 : 0.12}
          stroke={resaltado === l.id ? "#ffe600" : "white"}
          strokeWidth={resaltado === l.id ? 3 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {zonas.map((z, i) => (
        <polygon
          key={`z${i}`}
          points={puntosSvg(z)}
          fill="#e11d48"
          fillOpacity={0.35}
          stroke="#e11d48"
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </Lienzo>
  );
}

export function Leyenda({ lotes }: { lotes: LoteMapa[] }) {
  const cultivos = [...new Set(lotes.filter((l) => l.dibujo).map((l) => l.cultivo.split("/").pop()?.trim() || "Sin cultivo"))];
  if (!cultivos.length) return null;
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {cultivos.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: colorCultivo(c) }} aria-hidden />
          {c}
        </li>
      ))}
    </ul>
  );
}

/**
 * Editor de figuras: cada toque agrega un punto a la figura que se está marcando.
 * Con `multiple` se pueden marcar varias (manchones); si no, una sola (contorno del lote).
 */
export function EditorDibujo({
  foto,
  fondo,
  figuras,
  multiple = false,
  alCambiar,
}: {
  foto: FotoMapa;
  /** Lotes que se ven de referencia, sin editar. */
  fondo: LoteMapa[];
  figuras: Dibujo[];
  multiple?: boolean;
  alCambiar: (figuras: Dibujo[]) => void;
}) {
  const actual = figuras.length ? figuras[figuras.length - 1] : [];
  const anteriores = figuras.slice(0, -1);

  function agregar(p: [number, number]) {
    alCambiar([...anteriores, [...actual, p]]);
  }
  function deshacer() {
    if (actual.length > 1) alCambiar([...anteriores, actual.slice(0, -1)]);
    else alCambiar(anteriores);
  }

  return (
    <div className="flex flex-col gap-2">
      <Lienzo foto={foto} alTocar={agregar}>
        {fondo
          .filter((l) => l.dibujo)
          .map((l) => (
            <polygon
              key={l.id}
              points={puntosSvg(l.dibujo!)}
              fill={colorCultivo(l.cultivo)}
              fillOpacity={0.15}
              stroke="white"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {anteriores.map((f, i) => (
          <polygon
            key={i}
            points={puntosSvg(f)}
            fill="#e11d48"
            fillOpacity={0.35}
            stroke="#e11d48"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {actual.length > 0 && (
          <>
            <polygon
              points={puntosSvg(actual)}
              fill="#ffe600"
              fillOpacity={0.35}
              stroke="#ffe600"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            {actual.map(([x, y], i) => (
              <circle
                key={i}
                cx={x * 100}
                cy={y * 100}
                r={0.9}
                fill={i === 0 ? "#252a61" : "white"}
                stroke="#252a61"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </>
        )}
      </Lienzo>
      <p className="text-muted-foreground text-xs">
        Tocá la foto en cada esquina del {multiple ? "manchón" : "lote"}, siguiendo el borde. Se cierra solo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={deshacer}
          disabled={!figuras.length}
          className="bg-card hover:bg-muted flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
        >
          <Undo2 className="size-4" aria-hidden />
          Deshacer
        </button>
        <button
          type="button"
          onClick={() => alCambiar([])}
          disabled={!figuras.length}
          className="bg-card hover:bg-muted h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
        >
          Borrar {multiple ? "todo" : "contorno"}
        </button>
        {multiple && actual.length >= 3 && (
          <button
            type="button"
            onClick={() => alCambiar([...figuras, []])}
            className="bg-card hover:bg-muted h-10 rounded-lg border px-3 text-sm font-bold"
          >
            + Otro manchón
          </button>
        )}
      </div>
    </div>
  );
}

/** Figuras completas (3 puntos o más): las incompletas no se guardan. */
export const completas = (figuras: Dibujo[]) => figuras.filter((f) => f.length >= 3);

/** Achica la foto en el navegador y la suma a los mapas del campo. Devuelve el id de la foto o el error. */
export async function subirFotoMapa(campoId: number, archivo: File): Promise<{ id: number } | { error: string }> {
  let preparada;
  try {
    preparada = await prepararFoto(archivo);
  } catch {
    return { error: "No se pudo leer la foto. Probá con otra (JPG o PNG)." };
  }
  const datos = new FormData();
  datos.set("tipo", "campo");
  datos.set("destinoId", String(campoId));
  datos.set("archivo", new File([preparada.archivo], "mapa.jpg", { type: "image/jpeg" }));
  datos.set("ancho", String(preparada.ancho));
  datos.set("alto", String(preparada.alto));
  datos.set("fecha", hoyIso());
  datos.set("nota", "Mapa del campo");
  datos.set("mapa", "1");
  const r = await subirFoto(datos);
  URL.revokeObjectURL(preparada.vista);
  return r.ok ? { id: r.id } : { error: r.error };
}

/** Botones para pasar de un mapa a otro (solo si hay más de uno). */
export function SelectorMapa({
  mapas,
  elegido,
  lotes,
  alElegir,
}: {
  mapas: FotoMapa[];
  elegido: number | undefined;
  lotes: LoteMapa[];
  alElegir: (id: number) => void;
}) {
  if (mapas.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mapas del campo">
      {mapas.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => alElegir(m.id)}
          aria-pressed={m.id === elegido}
          className={cn(
            "h-9 rounded-full border px-3 text-xs font-bold",
            m.id === elegido ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
          )}
        >
          {nombreMapa(mapas, m.id, lotes)}
        </button>
      ))}
    </div>
  );
}

// ─── Sección "Mapas" de la ficha del campo ──────────────────────────────────

export function MapaCampo({
  campoId,
  mapas,
  fotos,
  lotes,
  disponible,
  motivo,
}: {
  campoId: number;
  /** Mapas del campo: si los lotes están lejos, cada grupo (o cada lote) va en su foto. */
  mapas: FotoMapa[];
  /** Fotos del campo, para sumar una como mapa. */
  fotos: Foto[];
  lotes: LoteMapa[];
  disponible: boolean;
  /** Por qué no se puede usar el almacenamiento (si `disponible` es false). */
  motivo?: string;
}) {
  const [modo, setModo] = useState<"ver" | "marcar" | "agregar">(mapas.length ? "ver" : "agregar");
  const [elegido, setElegido] = useState<number | undefined>(mapas[0]?.id);
  const [loteId, setLoteId] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Dibujo[]>([]);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();
  // Después de subir o quitar, el mapa elegido puede no estar todavía (o ya no estar) en la lista.
  const mapa = mapas.find((m) => m.id === elegido) ?? mapas[0];
  const lote = lotes.find((l) => l.id === loteId);
  const enEste = lotesEn(lotes, mapa?.id);
  const sinMarcar = lotes.filter((l) => !l.dibujo || !l.mapaId);

  function elegirMapa(id: number) {
    setElegido(id);
    setConfirmarQuitar(false);
    // Si se está marcando, el lote sigue elegido y se marca sobre el mapa nuevo.
    if (lote) setBorrador(lote.dibujo && lote.mapaId === id ? [lote.dibujo] : []);
  }

  function elegirLote(id: number) {
    setLoteId(id);
    const l = lotes.find((x) => x.id === id);
    setBorrador(l?.dibujo && l.mapaId === mapa?.id ? [l.dibujo] : []);
    setError("");
  }

  /** Sigue con el próximo lote sin marcar, para cargar todo el campo de una. */
  function siguiente() {
    const proximo = sinMarcar.find((l) => l.id !== lote?.id);
    if (proximo) elegirLote(proximo.id);
    else {
      setLoteId(null);
      setModo("ver");
    }
  }

  function guardar() {
    if (!lote || !mapa) return;
    const figura = completas(borrador)[0] ?? null;
    if (borrador.length && !figura) return setError("Marcá al menos 3 puntos (o borrá el contorno).");
    // Sin figura en este mapa: si el lote estaba marcado en otro, se deja como estaba.
    if (!figura && lote.mapaId !== mapa.id) return siguiente();
    iniciar(async () => {
      const r = await guardarDibujoLote(lote.id, figura, figura ? mapa.id : null);
      if (!r.ok) return setError(r.error);
      siguiente();
    });
  }

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    iniciar(async () => {
      const r = await subirFotoMapa(campoId, archivo);
      if ("error" in r) return setError(r.error);
      setElegido(r.id);
      setModo("ver");
    });
  }

  function cambiarMapa(fotoId: number, esMapa: boolean) {
    setError("");
    iniciar(async () => {
      const r = await usarComoMapa(campoId, fotoId, esMapa);
      if (!r.ok) return setError(r.error);
      setConfirmarQuitar(false);
      if (esMapa) {
        setElegido(fotoId);
        setModo("ver");
      } else setElegido(mapas.find((m) => m.id !== fotoId)?.id);
    });
  }

  const otrasFotos = fotos.filter((f) => !f.esMapa);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">{mapas.length > 1 ? "Mapas" : "Mapa"}</h2>
        {mapa && modo === "ver" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo("agregar")}
              className="bg-card hover:bg-muted h-10 rounded-lg border px-3 text-sm font-bold"
            >
              + Mapa
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("marcar");
                elegirLote((sinMarcar[0] ?? enEste[0] ?? lotes[0]).id);
              }}
              disabled={!lotes.length}
              className="bg-primary text-primary-foreground flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold disabled:opacity-50"
            >
              <Pencil className="size-4" aria-hidden />
              Marcar lotes
            </button>
          </div>
        )}
      </div>

      {!disponible ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
          {motivo ?? "Para el mapa hace falta el almacenamiento de fotos (SUPABASE_URL y SUPABASE_SECRET_KEY)."}
        </p>
      ) : modo === "agregar" || !mapa ? (
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 text-sm">
          <p className="text-muted-foreground">
            Subí una foto aérea o una captura (de Google Maps, de un dron…). Después marcás cada lote tocando sus
            esquinas y se pinta según el cultivo.
            {mapa && " Si los lotes están lejos entre sí, sumá una foto por cada grupo de lotes, o una por lote."}
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="bg-primary text-primary-foreground flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
              <Camera className="size-4" aria-hidden />
              {ocupado ? "Subiendo…" : mapa ? "Subir otro mapa" : "Subir foto del mapa"}
              <input type="file" accept="image/*" onChange={subir} className="sr-only" disabled={ocupado} />
            </label>
            {mapa && (
              <button type="button" onClick={() => setModo("ver")} className="bg-card hover:bg-muted h-10 rounded-lg border px-3 font-bold">
                Cancelar
              </button>
            )}
          </div>
          {otrasFotos.length > 0 && (
            <>
              <p className="font-bold">O usá una de las fotos del campo:</p>
              <ul className="grid grid-cols-4 gap-1.5">
                {otrasFotos.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => cambiarMapa(f.id, true)}
                      aria-label="Usar esta foto como mapa"
                      className="bg-muted relative block aspect-square w-full overflow-hidden rounded-lg"
                    >
                      <Image src={f.url} alt="" fill unoptimized sizes="25vw" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : modo === "marcar" ? (
        <div className="flex flex-col gap-2">
          <select
            aria-label="Lote a marcar"
            className={entrada}
            value={loteId ?? ""}
            onChange={(e) => elegirLote(Number(e.target.value))}
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} {l.nombre}{" "}
                {!l.dibujo || !l.mapaId
                  ? "(sin marcar)"
                  : l.mapaId === mapa.id
                    ? "✓"
                    : `(en mapa ${mapas.findIndex((m) => m.id === l.mapaId) + 1})`}
              </option>
            ))}
          </select>
          <SelectorMapa mapas={mapas} elegido={mapa.id} lotes={lotes} alElegir={elegirMapa} />
          {lote?.dibujo && lote.mapaId && lote.mapaId !== mapa.id && (
            <p className="text-muted-foreground text-xs">
              Este lote está marcado en otro mapa: si lo marcás en este, se pasa acá.
            </p>
          )}
          <EditorDibujo
            foto={mapa}
            fondo={enEste.filter((l) => l.id !== loteId)}
            figuras={borrador}
            alCambiar={(f) => setBorrador(f.slice(-1))}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setModo("ver");
                setLoteId(null);
              }}
              className="bg-card hover:bg-muted h-11 rounded-lg border text-sm font-bold"
            >
              Terminar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado}
              className="bg-primary text-primary-foreground h-11 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {ocupado ? "Guardando…" : `Guardar ${lote?.codigo || "lote"}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <SelectorMapa mapas={mapas} elegido={mapa.id} lotes={lotes} alElegir={elegirMapa} />
          <VistaMapa foto={mapa} lotes={enEste} conEnlaces />
          <Leyenda lotes={enEste} />
          {sinMarcar.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Sin marcar: {sinMarcar.map((l) => l.codigo || l.nombre).join(", ")}.
            </p>
          )}
          {confirmarQuitar ? (
            <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <span className="grow">
                ¿Quitar este mapa?{" "}
                {enEste.length > 0 && `${enEste.map((l) => l.codigo || l.nombre).join(", ")} van a quedar sin marcar. `}
                La foto sigue en la galería.
              </span>
              <button
                type="button"
                onClick={() => setConfirmarQuitar(false)}
                className="bg-card hover:bg-muted h-9 rounded-lg border px-3 font-bold"
              >
                No
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => cambiarMapa(mapa.id, false)}
                className="bg-destructive h-9 rounded-lg px-3 font-bold text-white disabled:opacity-50"
              >
                Sí, quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarQuitar(true)}
              className="text-muted-foreground w-fit text-xs font-bold underline"
            >
              Quitar este mapa
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

