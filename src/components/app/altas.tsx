"use client";

import { useState, useTransition } from "react";
import { Dialogo } from "./dialogo";
import type { Campo } from "@/lib/datos";
import { CATEGORIAS_LABOR, CATEGORIAS_PRODUCTO, CULTIVOS_SUGERIDOS, UNIDADES } from "@/lib/catalogos";
import { hoyIso, leerNumero, numeroEditable } from "@/lib/formato";
import { cn } from "@/lib/utils";
import {
  crearAporte,
  crearCampo,
  crearProducto,
  crearTipoLabor,
  guardarCotizacion,
  guardarLote,
  type ResultadoAlta,
} from "@/app/(app)/acciones-catalogos";

/** Formularios de alta (y edición de lote) que se abren en un Dialogo desde cualquier pantalla. */

export const etiqueta = "flex flex-col gap-1 text-sm font-bold";
export const entrada =
  "bg-card h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/30";

/** Se llama al guardar: `id` es el registro creado (no viene en modo demo). */
type AlGuardar = (id?: number) => void;

/** Envía una acción y maneja "guardando…" y el mensaje de error. */
function useEnvio(alGuardar: AlGuardar) {
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();
  const enviar = (accion: () => Promise<ResultadoAlta>) =>
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.error);
      else alGuardar(resultado.id);
    });
  return { error, setError, guardando, enviar };
}

function Pie({ error, guardando, texto = "Guardar" }: { error: string; guardando: boolean; texto?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className="bg-primary text-primary-foreground h-12 rounded-xl font-bold disabled:opacity-50"
      >
        {guardando ? "Guardando…" : texto}
      </button>
    </>
  );
}

// ─── Botón que abre un formulario ───────────────────────────────────────────

/** Botón (ej. "+ Campo") que abre el formulario en un Dialogo y lo cierra al guardar. */
export function BotonAlta({
  texto,
  titulo,
  variante = "primario",
  formulario,
}: {
  texto: string;
  titulo: string;
  variante?: "primario" | "secundario";
  formulario: (alGuardar: AlGuardar) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "h-10 rounded-lg px-3 text-sm font-bold",
          variante === "primario" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted border",
        )}
      >
        {texto}
      </button>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={titulo}>
        {formulario(() => setAbierto(false))}
      </Dialogo>
    </>
  );
}

// ─── Campo ──────────────────────────────────────────────────────────────────

export function FormCampo({ alGuardar }: { alGuardar: AlGuardar }) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        enviar(() => crearCampo({ nombre: String(f.get("nombre")), localidad: String(f.get("localidad")) }));
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input name="nombre" className={entrada} placeholder="Ej. Estancia Santa Marta" required autoFocus />
      </label>
      <label className={etiqueta}>
        Localidad
        <input name="localidad" className={entrada} placeholder="Opcional" />
      </label>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Lote (alta y edición) ──────────────────────────────────────────────────

export type ValoresLote = { campoId: number; nombre: string; codigo: string; ha: number; cultivo: string };

export function FormLote({
  campos,
  inicial,
  loteId,
  alGuardar,
}: {
  campos: Campo[];
  inicial?: Partial<ValoresLote>;
  loteId?: number;
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const [campoId, setCampoId] = useState(inicial?.campoId ? String(inicial.campoId) : "");
  const nuevoCampo = campoId === "__nuevo__";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ha = leerNumero(String(f.get("ha")));
        if (!(ha > 0)) return setError("La superficie tiene que ser un número mayor a 0.");
        enviar(() =>
          guardarLote(
            {
              campoId: nuevoCampo ? null : Number(campoId),
              nuevoCampo: nuevoCampo ? String(f.get("nuevoCampo")) : undefined,
              nombre: String(f.get("nombre")),
              codigo: String(f.get("codigo")),
              ha,
              cultivo: String(f.get("cultivo")),
            },
            loteId,
          ),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Campo *
        <select className={entrada} value={campoId} onChange={(e) => setCampoId(e.target.value)} required>
          <option value="">Elegí un campo…</option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
          <option value="__nuevo__">+ Nuevo campo…</option>
        </select>
      </label>
      {nuevoCampo && (
        <label className={etiqueta}>
          Nombre del campo nuevo *
          <input name="nuevoCampo" className={entrada} required autoFocus />
        </label>
      )}
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <label className={etiqueta}>
          Nombre del lote *
          <input name="nombre" className={entrada} defaultValue={inicial?.nombre} placeholder="Ej. La Planta" required />
        </label>
        <label className={etiqueta}>
          Código
          <input name="codigo" className={entrada} defaultValue={inicial?.codigo} placeholder="SM 1" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Superficie (ha) *
          <input
            name="ha"
            className={entrada}
            inputMode="decimal"
            defaultValue={inicial?.ha ? numeroEditable(inicial.ha) : ""}
            required
          />
        </label>
        <label className={etiqueta}>
          Cultivo (campaña actual)
          <input name="cultivo" className={entrada} list="cultivos" defaultValue={inicial?.cultivo} />
          <datalist id="cultivos">
            {CULTIVOS_SUGERIDOS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <Pie error={error} guardando={guardando} texto={loteId ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

// ─── Insumo ─────────────────────────────────────────────────────────────────

export function FormProducto({ alGuardar }: { alGuardar: AlGuardar }) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const precio = leerNumero(String(f.get("precio")));
        if (!(precio >= 0)) return setError("Escribí un precio válido (ej. 5,75).");
        enviar(() =>
          crearProducto({
            nombre: String(f.get("nombre")),
            categoria: String(f.get("categoria")),
            unidad: String(f.get("unidad")),
            precio,
            principioActivo: String(f.get("principioActivo")),
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre comercial *
        <input name="nombre" className={entrada} placeholder="Ej. Glifosato 66%" required autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo *
          <select name="categoria" className={entrada} required defaultValue="">
            <option value="" disabled>
              Elegí…
            </option>
            {CATEGORIAS_PRODUCTO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Unidad *
          <select name="unidad" className={entrada} required defaultValue="">
            <option value="" disabled>
              Elegí…
            </option>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.texto}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Precio USD por unidad *
          <input name="precio" className={entrada} inputMode="decimal" required />
        </label>
        <label className={etiqueta}>
          Principio activo
          <input name="principioActivo" className={entrada} placeholder="Opcional" />
        </label>
      </div>
      <p className="text-muted-foreground text-xs">La dosis se carga en la misma unidad que el precio (ej. L/ha y USD/L).</p>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Tipo de labor ──────────────────────────────────────────────────────────

export function FormTipoLabor({ alGuardar }: { alGuardar: AlGuardar }) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const [cotizacion, setCotizacion] = useState<"litros_gasoil" | "usd_fijo">("litros_gasoil");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const valor = leerNumero(String(f.get("valor")));
        if (!(valor >= 0)) return setError("Escribí una tarifa válida.");
        enviar(() =>
          crearTipoLabor({
            nombre: String(f.get("nombre")),
            categoria: String(f.get("categoria")),
            cotizacion,
            valor,
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input name="nombre" className={entrada} placeholder="Ej. Pulverización terrestre" required autoFocus />
      </label>
      <label className={etiqueta}>
        Tipo *
        <select name="categoria" className={entrada} required defaultValue="">
          <option value="" disabled>
            Elegí…
          </option>
          {CATEGORIAS_LABOR.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.texto}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">¿Cómo se cotiza? *</legend>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["litros_gasoil", "Litros de gasoil/ha"],
              ["usd_fijo", "USD/ha fijo"],
            ] as const
          ).map(([valor, texto]) => (
            <label
              key={valor}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border font-bold",
                cotizacion === valor && "border-primary bg-zafiro-suave text-primary",
              )}
            >
              <input
                type="radio"
                name="cotizacion"
                value={valor}
                checked={cotizacion === valor}
                onChange={() => setCotizacion(valor)}
                className="sr-only"
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={etiqueta}>
        {cotizacion === "litros_gasoil" ? "Litros de gasoil por ha *" : "USD por ha *"}
        <input name="valor" className={entrada} inputMode="decimal" required />
      </label>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Aporte ─────────────────────────────────────────────────────────────────

export function FormAporte({ alGuardar }: { alGuardar: AlGuardar }) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        enviar(() => crearAporte({ nombre: String(f.get("nombre")) }));
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input name="nombre" className={entrada} placeholder="Ej. Buatti SRL" required autoFocus />
      </label>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Cotización ─────────────────────────────────────────────────────────────

export function FormCotizacion({
  actual,
  alGuardar,
}: {
  actual: { tipoCambio: number; precioGasoil: number };
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const tipoCambio = leerNumero(String(f.get("tipoCambio")));
        const precioGasoil = leerNumero(String(f.get("precioGasoil")));
        if (!(tipoCambio > 0) || !(precioGasoil >= 0)) return setError("Revisá los valores.");
        enviar(() => guardarCotizacion({ fecha: String(f.get("fecha")), tipoCambio, precioGasoil }));
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo de cambio ($/USD) *
          <input
            name="tipoCambio"
            className={entrada}
            inputMode="decimal"
            defaultValue={numeroEditable(actual.tipoCambio)}
            required
          />
        </label>
        <label className={etiqueta}>
          Gasoil ($/L) *
          <input
            name="precioGasoil"
            className={entrada}
            inputMode="decimal"
            defaultValue={numeroEditable(actual.precioGasoil)}
            required
          />
        </label>
      </div>
      <label className={etiqueta}>
        Vigente desde *
        <input name="fecha" type="date" className={entrada} defaultValue={hoyIso()} required />
      </label>
      <p className="text-muted-foreground text-xs">
        Cambia el costo en USD/ha de las labores que se carguen desde ahora. Las ya cargadas no cambian.
      </p>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Botones listos para los encabezados (las páginas son de servidor) ──────

export function BotonesCamposLotes({ campos }: { campos: Campo[] }) {
  return (
    <>
      <BotonAlta
        texto="+ Campo"
        titulo="Nuevo campo"
        variante="secundario"
        formulario={(listo) => <FormCampo alGuardar={listo} />}
      />
      <BotonAlta
        texto="+ Lote"
        titulo="Nuevo lote"
        formulario={(listo) => <FormLote campos={campos} alGuardar={listo} />}
      />
    </>
  );
}

export function BotonEditarLote({ campos, lote }: { campos: Campo[]; lote: ValoresLote & { id: number } }) {
  return (
    <BotonAlta
      texto="Editar"
      titulo="Editar lote"
      variante="secundario"
      formulario={(listo) => <FormLote campos={campos} inicial={lote} loteId={lote.id} alGuardar={listo} />}
    />
  );
}

export function BotonNuevoInsumo() {
  return <BotonAlta texto="+ Insumo" titulo="Nuevo insumo" formulario={(listo) => <FormProducto alGuardar={listo} />} />;
}

export function BotonNuevaLabor() {
  return (
    <BotonAlta texto="+ Labor" titulo="Nuevo tipo de labor" formulario={(listo) => <FormTipoLabor alGuardar={listo} />} />
  );
}

export function BotonCotizacion({ actual }: { actual: { tipoCambio: number; precioGasoil: number } }) {
  return (
    <BotonAlta
      texto="Actualizar cotización"
      titulo="Tipo de cambio y gasoil"
      variante="secundario"
      formulario={(listo) => <FormCotizacion actual={actual} alGuardar={listo} />}
    />
  );
}
