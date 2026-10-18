"use client";

import type { Cosecha } from "@/lib/datos";
import { BotonAlta, Pie, entrada, etiqueta, numeroOpcional, useEnvio } from "@/components/app/altas";
import { hoyIso, numeroEditable } from "@/lib/formato";
import { guardarCosecha } from "../acciones";

/** Porcentaje guardado como fracción (0,05) → texto editable ("5"). */
const porcentaje = (f: number | null | undefined) => (f == null ? "" : numeroEditable(f * 100));

function FormCosecha({ loteId, inicial, alGuardar }: { loteId: number; inicial?: Cosecha; alGuardar: () => void }) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const rinde = numeroOpcional(f, "rinde");
        const precio = numeroOpcional(f, "precio");
        const arrendamiento = numeroOpcional(f, "arrendamiento");
        const gastos = numeroOpcional(f, "gastos");
        const flete = numeroOpcional(f, "flete");
        if (rinde === null || Number.isNaN(rinde)) return setError("Escribí el rinde en kg/ha.");
        if (precio === null || Number.isNaN(precio)) return setError("Escribí el precio en USD/tn.");
        if ([arrendamiento, gastos, flete].some((v) => v !== null && Number.isNaN(v)))
          return setError("Revisá los porcentajes y el flete.");
        enviar(() =>
          guardarCosecha(loteId, {
            fecha: String(f.get("fecha") || "") || null,
            rindeKgHa: rinde,
            precioPizarra: precio,
            arrendamientoPorcentaje: arrendamiento === null ? null : arrendamiento / 100,
            gastosComercializacionPorcentaje: gastos === null ? null : gastos / 100,
            fleteUsdTn: flete,
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Rinde (kg/ha) *
          <input
            name="rinde"
            className={entrada}
            inputMode="decimal"
            defaultValue={inicial ? numeroEditable(inicial.rindeKgHa) : ""}
            required
            autoFocus
          />
        </label>
        <label className={etiqueta}>
          Fecha de cosecha
          <input name="fecha" type="date" className={entrada} defaultValue={inicial?.fecha || hoyIso()} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Precio (USD/tn) *
          <input
            name="precio"
            className={entrada}
            inputMode="decimal"
            defaultValue={inicial ? numeroEditable(inicial.precioPizarra) : ""}
            required
          />
        </label>
        <label className={etiqueta}>
          Arrendamiento (%)
          <input
            name="arrendamiento"
            className={entrada}
            inputMode="decimal"
            defaultValue={porcentaje(inicial?.arrendamientoPorcentaje)}
            placeholder="Ej. 25"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Gastos comerc. (%)
          <input
            name="gastos"
            className={entrada}
            inputMode="decimal"
            defaultValue={porcentaje(inicial?.gastosComercializacionPorcentaje)}
            placeholder="Ej. 5"
          />
        </label>
        <label className={etiqueta}>
          Flete (USD/tn)
          <input
            name="flete"
            className={entrada}
            inputMode="decimal"
            defaultValue={inicial?.fleteUsdTn ? numeroEditable(inicial.fleteUsdTn) : ""}
          />
        </label>
      </div>
      <p className="text-muted-foreground text-xs">
        El margen bruto descuenta el arrendamiento de la producción y resta comercialización, flete, labores, insumos y
        otros gastos del lote.
      </p>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

export function BotonCosecha({ loteId, inicial }: { loteId: number; inicial?: Cosecha }) {
  return (
    <BotonAlta
      texto={inicial ? "Editar cosecha" : "Cargar cosecha"}
      titulo="Cosecha y comercialización"
      variante={inicial ? "secundario" : "primario"}
      formulario={(listo) => <FormCosecha loteId={loteId} inicial={inicial} alGuardar={listo} />}
    />
  );
}
