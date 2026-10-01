"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Dialogo } from "./dialogo";
import { entrada, etiqueta } from "./altas";
import { eliminarFoto, subirFoto } from "@/app/(app)/acciones-fotos";
import { fechaCorta } from "@/lib/formato";
import type { Foto } from "@/lib/fotos";

/** Lado mayor de la foto que se sube: alcanza para verla bien y pesa ~0,3–0,5 MB. */
const LADO_MAXIMO = 1600;

type Preparada = { archivo: Blob; vista: string; ancho: number; alto: number; fecha: string };

/** Achica la foto en el navegador (respetando la orientación del celular) y la pasa a JPEG. */
async function prepararFoto(original: File): Promise<Preparada> {
  const imagen = await createImageBitmap(original, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();
  const archivo = await new Promise<Blob>((ok, mal) =>
    lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.82),
  );
  // La fecha del archivo suele ser la de cuando se sacó la foto.
  const fecha = new Date(original.lastModified || Date.now()).toLocaleDateString("en-CA");
  return { archivo, vista: URL.createObjectURL(archivo), ancho, alto, fecha };
}

export function GaleriaFotos({
  destino,
  fotos,
  disponible,
  motivo,
}: {
  destino: { tipo: "campo" | "lote"; id: number };
  fotos: Foto[];
  disponible: boolean;
  motivo?: string;
}) {
  const [preparada, setPreparada] = useState<Preparada | null>(null);
  const [abierta, setAbierta] = useState<Foto | null>(null);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite elegir la misma foto otra vez
    if (!archivo) return;
    setError("");
    setProcesando(true);
    try {
      setPreparada(await prepararFoto(archivo));
    } catch {
      setError("No se pudo leer la foto. Probá con otra (JPG o PNG).");
    } finally {
      setProcesando(false);
    }
  }

  function cerrarNueva() {
    if (preparada) URL.revokeObjectURL(preparada.vista);
    setPreparada(null);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">
          Fotos {fotos.length > 0 && <span className="text-muted-foreground font-normal">({fotos.length})</span>}
        </h2>
        {disponible && (
          <label className="bg-primary text-primary-foreground flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <Camera className="size-4" aria-hidden />
            {procesando ? "Preparando…" : "+ Foto"}
            <input type="file" accept="image/*" onChange={elegir} className="sr-only" disabled={procesando} />
          </label>
        )}
      </div>

      {!disponible ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">{motivo}</p>
      ) : fotos.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
          Todavía no hay fotos. Con &quot;+ Foto&quot; podés sacar una con el celular o elegirla de la galería.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setAbierta(f)}
                aria-label={`Ver foto del ${fechaCorta(f.fecha)}${f.nota ? `: ${f.nota}` : ""}`}
                className="bg-muted relative block aspect-square w-full overflow-hidden rounded-lg"
              >
                <Image src={f.url} alt="" fill unoptimized sizes="33vw" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-0.5 text-left text-[11px] text-white">
                  {fechaCorta(f.fecha)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}

      <Dialogo abierto={preparada !== null} alCerrar={cerrarNueva} titulo="Nueva foto">
        {preparada && <FormNuevaFoto destino={destino} preparada={preparada} alTerminar={cerrarNueva} />}
      </Dialogo>

      <Dialogo abierto={abierta !== null} alCerrar={() => setAbierta(null)} titulo="Foto">
        {abierta && <VerFoto foto={abierta} alBorrar={() => setAbierta(null)} />}
      </Dialogo>
    </section>
  );
}

function FormNuevaFoto({
  destino,
  preparada,
  alTerminar,
}: {
  destino: { tipo: "campo" | "lote"; id: number };
  preparada: Preparada;
  alTerminar: () => void;
}) {
  const [error, setError] = useState("");
  const [subiendo, iniciar] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        datos.set("tipo", destino.tipo);
        datos.set("destinoId", String(destino.id));
        datos.set("archivo", new File([preparada.archivo], "foto.jpg", { type: "image/jpeg" }));
        datos.set("ancho", String(preparada.ancho));
        datos.set("alto", String(preparada.alto));
        iniciar(async () => {
          const resultado = await subirFoto(datos);
          if (resultado.ok) alTerminar();
          else setError(resultado.error);
        });
      }}
      className="flex flex-col gap-3"
    >
      <Image
        src={preparada.vista}
        alt="Vista previa"
        width={preparada.ancho}
        height={preparada.alto}
        unoptimized
        className="max-h-[45dvh] w-full rounded-lg object-contain"
      />
      <label className={etiqueta}>
        Fecha *
        <input name="fecha" type="date" className={entrada} defaultValue={preparada.fecha} required />
      </label>
      <label className={etiqueta}>
        Nota
        <textarea
          name="nota"
          rows={2}
          placeholder="Ej. maleza en la cabecera, estado del cultivo…"
          className="bg-card border-input focus:border-ring rounded-lg border p-3 font-normal outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={subiendo}
        className="bg-primary text-primary-foreground h-12 rounded-xl font-bold disabled:opacity-50"
      >
        {subiendo ? "Subiendo…" : "Guardar foto"}
      </button>
    </form>
  );
}

function VerFoto({ foto, alBorrar }: { foto: Foto; alBorrar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [borrando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <Image
        src={foto.url}
        alt={foto.nota ?? "Foto"}
        width={foto.ancho ?? 1600}
        height={foto.alto ?? 1200}
        unoptimized
        className="max-h-[60dvh] w-full rounded-lg object-contain"
      />
      <p className="text-sm">
        <span className="font-bold">{fechaCorta(foto.fecha)}</span>
        {foto.nota && <span className="text-muted-foreground"> · {foto.nota}</span>}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {confirmar ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            className="bg-card hover:bg-muted h-11 rounded-lg border text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={borrando}
            onClick={() =>
              iniciar(async () => {
                const resultado = await eliminarFoto(foto.id);
                if (resultado.ok) alBorrar();
                else setError(resultado.error);
              })
            }
            className="bg-destructive h-11 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          >
            {borrando ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="text-destructive hover:bg-destructive/5 flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-bold"
        >
          <Trash2 className="size-4" aria-hidden />
          Borrar foto
        </button>
      )}
    </div>
  );
}
