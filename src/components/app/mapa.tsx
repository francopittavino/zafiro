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
import { elegirFotoMapa, guardarDibujoLote } from "@/app/(app)/acciones-mapa";
import { subirFoto } from "@/app/(app)/acciones-fotos";
import { prepararFoto } from "./galeria-fotos";
import { entrada } from "./altas";

/**
 * Mapa propio sobre una foto del campo (sin GIS): los lotes y los manchones son
 * figuras con puntos relativos a la foto (0 a 1). El SVG va estirado encima de la
 * imagen (viewBox 0..100); las etiquetas son HTML para que no se deformen.
 */

export type LoteMapa = { id: number; codigo: string; nombre: string; cultivo: string; dibujo?: Dibujo | null };

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

// ─── Sección "Mapa" de la ficha del campo ───────────────────────────────────

export function MapaCampo({
  campoId,
  foto,
  fotos,
  lotes,
  disponible,
}: {
  campoId: number;
  foto: FotoMapa | null;
  /** Fotos del campo, para elegir otra como mapa. */
  fotos: Foto[];
  lotes: LoteMapa[];
  disponible: boolean;
}) {
  const [modo, setModo] = useState<"ver" | "marcar" | "foto">(foto ? "ver" : "foto");
  const [loteId, setLoteId] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Dibujo[]>([]);
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();
  const lote = lotes.find((l) => l.id === loteId);

  function elegirLote(id: number) {
    setLoteId(id);
    const elegido = lotes.find((l) => l.id === id);
    setBorrador(elegido?.dibujo ? [elegido.dibujo] : []);
    setError("");
  }

  function guardar() {
    if (!lote) return;
    const figura = completas(borrador)[0] ?? null;
    if (borrador.length && !figura) return setError("Marcá al menos 3 puntos (o borrá el contorno).");
    iniciar(async () => {
      const r = await guardarDibujoLote(lote.id, figura);
      if (!r.ok) return setError(r.error);
      // Sigue con el próximo lote sin marcar, para cargar todo el campo de una.
      const siguiente = lotes.find((l) => l.id !== lote.id && !l.dibujo);
      if (siguiente) elegirLote(siguiente.id);
      else {
        setLoteId(null);
        setModo("ver");
      }
    });
  }

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    try {
      const preparada = await prepararFoto(archivo);
      const datos = new FormData();
      datos.set("tipo", "campo");
      datos.set("destinoId", String(campoId));
      datos.set("archivo", new File([preparada.archivo], "mapa.jpg", { type: "image/jpeg" }));
      datos.set("ancho", String(preparada.ancho));
      datos.set("alto", String(preparada.alto));
      datos.set("fecha", hoyIso());
      datos.set("nota", "Mapa del campo");
      datos.set("mapa", "1");
      iniciar(async () => {
        const r = await subirFoto(datos);
        URL.revokeObjectURL(preparada.vista);
        if (!r.ok) setError(r.error);
        else setModo("ver");
      });
    } catch {
      setError("No se pudo leer la foto. Probá con otra (JPG o PNG).");
    }
  }

  const botonSubir = (
    <label className="bg-primary text-primary-foreground flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <Camera className="size-4" aria-hidden />
      {ocupado ? "Subiendo…" : "Subir foto del mapa"}
      <input type="file" accept="image/*" onChange={subir} className="sr-only" disabled={ocupado} />
    </label>
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Mapa</h2>
        {foto && modo === "ver" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo("foto")}
              className="bg-card hover:bg-muted h-10 rounded-lg border px-3 text-sm font-bold"
            >
              Cambiar foto
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("marcar");
                elegirLote((lotes.find((l) => !l.dibujo) ?? lotes[0]).id);
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
          Para el mapa hace falta el almacenamiento de fotos (SUPABASE_URL y SUPABASE_SECRET_KEY).
        </p>
      ) : modo === "foto" || !foto ? (
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 text-sm">
          <p className="text-muted-foreground">
            Subí una foto aérea o una captura del campo (de Google Maps, de un dron…). Después marcás cada lote tocando
            sus esquinas y se pinta según el cultivo.
          </p>
          <div className="flex flex-wrap gap-2">
            {botonSubir}
            {foto && (
              <button type="button" onClick={() => setModo("ver")} className="bg-card hover:bg-muted h-10 rounded-lg border px-3 font-bold">
                Cancelar
              </button>
            )}
          </div>
          {fotos.length > 0 && (
            <>
              <p className="font-bold">O elegí una de las fotos del campo:</p>
              <ul className="grid grid-cols-4 gap-1.5">
                {fotos.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        iniciar(async () => {
                          const r = await elegirFotoMapa(campoId, f.id);
                          if (!r.ok) setError(r.error);
                          else setModo("ver");
                        })
                      }
                      aria-label="Usar esta foto como mapa"
                      className={cn(
                        "bg-muted relative block aspect-square w-full overflow-hidden rounded-lg",
                        foto?.id === f.id && "ring-primary ring-3",
                      )}
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
                {l.codigo} {l.nombre} {l.dibujo ? "✓" : "(sin marcar)"}
              </option>
            ))}
          </select>
          <EditorDibujo
            foto={foto}
            fondo={lotes.filter((l) => l.id !== loteId)}
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
          <VistaMapa foto={foto} lotes={lotes} conEnlaces />
          <Leyenda lotes={lotes} />
          {lotes.some((l) => !l.dibujo) && (
            <p className="text-muted-foreground text-xs">
              Sin marcar: {lotes.filter((l) => !l.dibujo).map((l) => l.codigo || l.nombre).join(", ")}.
            </p>
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
