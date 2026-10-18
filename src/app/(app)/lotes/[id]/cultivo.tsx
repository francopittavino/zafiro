"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileDown } from "lucide-react";
import type { Ciclo } from "@/lib/datos";
import { BotonAlta, Pie, entrada, etiqueta, useEnvio } from "@/components/app/altas";
import { CULTIVOS_SUGERIDOS } from "@/lib/catalogos";
import { fechaCorta, hoyIso } from "@/lib/formato";
import { cerrarCultivo, iniciarCultivo, reabrirCultivo } from "../acciones";

/** Cierre manual del cultivo (después de la cosecha): después se ve su informe de cierre. */
export function BotonCerrarCultivo({ loteId, cultivo, sinCosecha }: { loteId: number; cultivo: string; sinCosecha: boolean }) {
  const router = useRouter();
  return (
    <BotonAlta
      texto="Cerrar cultivo"
      titulo={`Cerrar ${cultivo}`}
      variante="secundario"
      formulario={(alGuardar) => <FormCerrar loteId={loteId} sinCosecha={sinCosecha} alGuardar={(id) => {
        alGuardar();
        if (id) router.push(`/informes?ciclo=${id}`);
      }} />}
    />
  );
}

function FormCerrar({ loteId, sinCosecha, alGuardar }: { loteId: number; sinCosecha: boolean; alGuardar: (id?: number) => void }) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        enviar(() => cerrarCultivo(loteId, String(f.get("fecha"))));
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-muted-foreground text-sm">
        El cultivo queda cerrado con todo lo cargado (labores, gastos, cosecha) y sale su informe de cierre. Después
        podés iniciar el próximo cultivo en el lote. Si te equivocás, se puede volver a abrir.
      </p>
      {sinCosecha && (
        <p className="bg-sol/30 rounded-lg p-3 text-sm">
          Todavía no cargaste la cosecha: sin el rinde, el informe no va a tener el margen bruto.
        </p>
      )}
      <label className={etiqueta}>
        Fecha de cierre
        <input name="fecha" type="date" className={entrada} defaultValue={hoyIso()} required />
      </label>
      <Pie error={error} guardando={guardando} texto="Cerrar cultivo" />
    </form>
  );
}

/** Empieza un cultivo nuevo en el lote (con su campaña: si es nueva, se crea). */
export function BotonIniciarCultivo({ loteId, campanias, sugerida }: { loteId: number; campanias: string[]; sugerida: string }) {
  return (
    <BotonAlta
      texto="Iniciar cultivo"
      titulo="Iniciar cultivo"
      formulario={(alGuardar) => <FormIniciar loteId={loteId} campanias={campanias} sugerida={sugerida} alGuardar={alGuardar} />}
    />
  );
}

function FormIniciar({
  loteId,
  campanias,
  sugerida,
  alGuardar,
}: {
  loteId: number;
  campanias: string[];
  sugerida: string;
  alGuardar: () => void;
}) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        enviar(() =>
          iniciarCultivo(loteId, {
            cultivo: String(f.get("cultivo")),
            variedad: String(f.get("variedad") ?? ""),
            fechaSiembra: String(f.get("fechaSiembra") ?? ""),
            campania: String(f.get("campania")),
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Cultivo *
          <input name="cultivo" className={entrada} list="cultivos-nuevos" required autoFocus />
          <datalist id="cultivos-nuevos">
            {CULTIVOS_SUGERIDOS.filter((c) => !c.includes("/")).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={etiqueta}>
          Campaña *
          <input name="campania" className={entrada} list="campanias" defaultValue={sugerida} placeholder="2025/26" required />
          <datalist id="campanias">
            {campanias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Variedad / híbrido
          <input name="variedad" className={entrada} />
        </label>
        <label className={etiqueta}>
          Fecha de siembra
          <input name="fechaSiembra" type="date" className={entrada} />
        </label>
      </div>
      <Pie error={error} guardando={guardando} texto="Iniciar cultivo" />
    </form>
  );
}

/** Cultivos anteriores del lote, con su informe de cierre. */
export function HistorialCultivos({ ciclos, hayEnCurso }: { ciclos: Ciclo[]; hayEnCurso: boolean }) {
  const [error, setError] = useState("");
  const [reabriendo, iniciar] = useTransition();
  if (!ciclos.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-bold">Cultivos anteriores</h2>
      <ul className="bg-card divide-y rounded-xl border text-sm">
        {ciclos.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <Link href={`/informes?ciclo=${c.id}`} className="min-w-0">
              <span className="block font-bold">{c.cultivo}</span>
              <span className="text-muted-foreground block text-xs">
                Campaña {c.campania}
                {c.fechaCierre && ` · cerrado el ${fechaCorta(c.fechaCierre)}`}
              </span>
            </Link>
            <span className="flex shrink-0 items-center gap-3">
              {!hayEnCurso && (
                <button
                  type="button"
                  disabled={reabriendo}
                  onClick={() => {
                    if (!window.confirm(`¿Volver a abrir ${c.cultivo} (campaña ${c.campania})?`)) return;
                    iniciar(async () => {
                      const r = await reabrirCultivo(c.id);
                      setError(r.ok ? "" : r.error);
                    });
                  }}
                  className="text-muted-foreground text-xs font-bold underline disabled:opacity-50"
                >
                  Reabrir
                </button>
              )}
              <a
                href={`/informes/pdf?ciclo=${c.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-zafiro flex items-center gap-1 font-bold"
              >
                <FileDown className="size-4" aria-hidden /> Informe
              </a>
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
