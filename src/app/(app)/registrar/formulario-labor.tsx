"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileDown, Trash2 } from "lucide-react";
import type { Dibujo } from "@/db/schema";
import type {
  Campo,
  CampoPersonalizado,
  DatosAplicacion,
  Existencia,
  InsumoAplicado,
  Lote,
  Producto,
} from "@/lib/datos";
import { NOMBRE_CATEGORIA, fechaCorta, hoyIso, leerNumero, num, numeroEditable, usd2 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { guardarLabor } from "./acciones";
import { Dialogo } from "@/components/app/dialogo";
import { FormLote, FormProducto, FormTipoLabor, MasDatos } from "@/components/app/altas";
import { CamposExtra, leerExtras } from "@/components/app/campos-extra";
import { EditorDibujo, completas } from "@/components/app/mapa";
import type { FotoMapa } from "@/lib/fotos";

const NUEVO = "__nuevo__";
type Alta = "lote" | "labor" | "producto";

type TipoLaborOpcion = { id: number; nombre: string; tarifa: number; detalle: string };
type Linea = { clave: number; productoId: number; dosis: string; precio: string };
/** Receta que se puede vincular a la labor (las del lote elegido). */
export type RecetaOpcion = {
  id: number;
  numero: number;
  loteId: number;
  fecha: string;
  objetivo: string | null;
  items: { productoId: number; dosis: number }[];
};

/** Datos con los que arranca el formulario (al editar, duplicar o venir desde un lote). */
export type ValoresIniciales = {
  loteId: number;
  fecha?: string;
  tipoLaborId?: number | null;
  ha: number;
  costoLaborHa?: number;
  aporte?: string | null;
  notas?: string;
  insumos?: InsumoAplicado[];
  modalidad?: "propia" | "contratista" | null;
  contratista?: string | null;
  cobro?: "ha" | "hora";
  horas?: number | null;
  costoHora?: number | null;
  aplicacion?: DatosAplicacion;
  zonas?: Dibujo[] | null;
  recetaId?: number | null;
  extras?: Record<string, string> | null;
  /** Si la labor guardada había descontado stock (al editar se mantiene). */
  descontoStock?: boolean;
};

const SIN_APLICACION: DatosAplicacion = {
  caudalLHa: null,
  temperatura: null,
  humedad: null,
  vientoKmH: null,
  vientoDireccion: null,
  aplicador: null,
};

/** Número opcional de un input: vacío → null, inválido → NaN. */
const opcional = (texto: string) => (texto.trim() ? leerNumero(texto) : null);
const editable = (valor: number | null | undefined) => (valor == null ? "" : numeroEditable(valor));

const etiqueta = "flex flex-col gap-1 text-sm font-bold";
const entrada =
  "bg-card h-11 rounded-lg border border-input px-3 font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/30";

export function FormularioLabor({
  campos,
  lotes,
  productos,
  tiposLabor,
  aportes,
  contratistas,
  personalizados,
  stock,
  mapas,
  recetas,
  inicial,
  laborId,
}: {
  campos: Campo[];
  lotes: Lote[];
  productos: Producto[];
  tiposLabor: TipoLaborOpcion[];
  aportes: string[];
  contratistas: string[];
  personalizados: CampoPersonalizado[];
  stock: Existencia[];
  /** Foto del mapa de cada campo (campoId → foto), para marcar manchones. */
  mapas: Record<number, FotoMapa>;
  recetas: RecetaOpcion[];
  inicial?: ValoresIniciales;
  /** Si viene, el formulario edita esa labor en vez de crear una nueva. */
  laborId?: number;
}) {
  const router = useRouter();
  const editando = laborId !== undefined;
  const [loteId, setLoteId] = useState(inicial ? String(inicial.loteId) : "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyIso());
  const [tipoId, setTipoId] = useState(inicial?.tipoLaborId ? String(inicial.tipoLaborId) : "");
  const [ha, setHa] = useState(inicial ? numeroEditable(inicial.ha) : "");
  const [costoHa, setCostoHa] = useState(
    // Valor exacto de la labor guardada: redondearlo cambiaría el costo al editar.
    inicial?.costoLaborHa !== undefined ? numeroEditable(inicial.costoLaborHa) : "",
  );
  const [aporte, setAporte] = useState(inicial?.aporte !== undefined ? (inicial.aporte ?? "") : (aportes[0] ?? ""));
  const [lineas, setLineas] = useState<Linea[]>(() =>
    (inicial?.insumos ?? []).map((i, n) => ({
      clave: n,
      productoId: i.productoId,
      dosis: numeroEditable(i.dosis),
      // Al editar o duplicar se respeta el precio guardado en la labor (snapshot).
      precio: numeroEditable(i.precio),
    })),
  );
  const [agregar, setAgregar] = useState("");
  const [recienAgregada, setRecienAgregada] = useState<number | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  /** Última labor guardada, para ofrecer su PDF. */
  const [guardadaId, setGuardadaId] = useState<number | null>(null);
  const [recetaId, setRecetaId] = useState(inicial?.recetaId ? String(inicial.recetaId) : "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [modalidad, setModalidad] = useState<"propia" | "contratista" | "">(inicial?.modalidad ?? "");
  const [contratista, setContratista] = useState(inicial?.contratista ?? "");
  const [cobro, setCobro] = useState<"ha" | "hora">(inicial?.cobro ?? "ha");
  const [horas, setHoras] = useState(editable(inicial?.horas));
  const [costoHora, setCostoHora] = useState(editable(inicial?.costoHora));
  const ap = inicial?.aplicacion ?? SIN_APLICACION;
  const [aplicacion, setAplicacion] = useState({
    caudalLHa: editable(ap.caudalLHa),
    temperatura: editable(ap.temperatura),
    humedad: editable(ap.humedad),
    vientoKmH: editable(ap.vientoKmH),
    vientoDireccion: ap.vientoDireccion ?? "",
    aplicador: ap.aplicador ?? "",
  });
  const [descontarStock, setDescontarStock] = useState(inicial?.descontoStock ?? true);
  // Los campos personalizados no tienen estado: se leen del formulario al guardar y se reinician cambiando la key.
  const formulario = useRef<HTMLFormElement>(null);
  const [vueltaExtras, setVueltaExtras] = useState(0);
  const extrasLabor = personalizados.filter((c) => c.entidad === "labor");
  const [zonas, setZonas] = useState<Dibujo[]>(inicial?.zonas ?? []);
  const [enManchones, setEnManchones] = useState(Boolean(inicial?.zonas?.length));
  const [guardando, iniciarGuardado] = useTransition();
  // Alta en el momento (lote, labor o producto nuevo) y el registro creado a elegir.
  const [alta, setAlta] = useState<Alta | null>(null);
  const [pendiente, setPendiente] = useState<{ tipo: Alta; id: number } | null>(null);

  if (pendiente) {
    const lista = pendiente.tipo === "lote" ? lotes : pendiente.tipo === "labor" ? tiposLabor : productos;
    if (lista.some((x) => x.id === pendiente.id)) {
      setPendiente(null);
      if (pendiente.tipo === "lote") elegirLote(String(pendiente.id));
      else if (pendiente.tipo === "labor") elegirTipo(String(pendiente.id));
      else agregarProducto(String(pendiente.id));
    }
  }

  const lote = lotes.find((l) => String(l.id) === loteId);
  const recetasDelLote = recetas.filter((r) => String(r.loteId) === loteId);
  const tipo = tiposLabor.find((t) => String(t.id) === tipoId);
  const haNum = leerNumero(ha) || 0;

  const costoInsumos = lineas.reduce((t, l) => t + (leerNumero(l.dosis) || 0) * (leerNumero(l.precio) || 0) * haNum, 0);
  const costoTrabajo =
    cobro === "hora" ? (leerNumero(horas) || 0) * (leerNumero(costoHora) || 0) : (leerNumero(costoHa) || 0) * haNum;
  const stockDe = (productoId: number) =>
    lote ? (stock.find((s) => s.campoId === lote.campoId && s.productoId === productoId)?.cantidad ?? 0) : 0;
  const total = costoInsumos + costoTrabajo;

  function terminarAlta(tipo: Alta) {
    return (id?: number) => {
      setAlta(null);
      if (id !== undefined) setPendiente({ tipo, id });
    };
  }

  function elegirLote(id: string) {
    if (id === NUEVO) return setAlta("lote");
    setLoteId(id);
    // La receta es de un lote: si se cambia de lote, deja de valer.
    if (!recetas.some((r) => String(r.id) === recetaId && String(r.loteId) === id)) setRecetaId("");
    const nuevo = lotes.find((l) => String(l.id) === id);
    if (nuevo) setHa(numeroEditable(nuevo.ha));
  }

  function elegirTipo(id: string) {
    if (id === NUEVO) return setAlta("labor");
    setTipoId(id);
    const nuevo = tiposLabor.find((t) => String(t.id) === id);
    if (nuevo) setCostoHa(numeroEditable(Math.round(nuevo.tarifa * 100) / 100));
  }

  function elegirReceta(id: string) {
    setRecetaId(id);
    const receta = recetas.find((r) => String(r.id) === id);
    // Si todavía no hay productos, se cargan los de la receta (con el precio de lista).
    if (!receta || lineas.length) return;
    setLineas(
      receta.items.flatMap((i, n) => {
        const producto = productos.find((p) => p.id === i.productoId);
        return producto
          ? [{ clave: Date.now() + n, productoId: producto.id, dosis: numeroEditable(i.dosis), precio: numeroEditable(producto.precio) }]
          : [];
      }),
    );
  }

  function agregarProducto(id: string) {
    if (id === NUEVO) return setAlta("producto");
    const producto = productos.find((p) => String(p.id) === id);
    if (!producto) return;
    const clave = Date.now();
    setLineas((previas) => [
      ...previas,
      { clave, productoId: producto.id, dosis: "", precio: numeroEditable(producto.precio) },
    ]);
    setRecienAgregada(clave);
    setAgregar("");
  }

  const cambiarLinea = (clave: number, cambio: Partial<Linea>) =>
    setLineas((previas) => previas.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));

  function limpiar(cargarOtra: boolean) {
    // Como en la planilla: "cargar otra" mantiene lote y fecha.
    if (!cargarOtra) {
      setLoteId("");
      setHa("");
    }
    setTipoId("");
    setCostoHa("");
    setLineas([]);
    setNotas("");
    setHoras("");
    setZonas([]);
    setEnManchones(false);
    setRecetaId("");
    setVueltaExtras((v) => v + 1);
  }

  function guardar(cargarOtra: boolean) {
    const faltan: string[] = [];
    if (!lote) faltan.push("Elegí el lote.");
    if (!fecha) faltan.push("Completá la fecha.");
    if (!tipo) faltan.push("Elegí la labor.");
    if (!(haNum > 0)) faltan.push("Las hectáreas tienen que ser mayores a 0.");
    if (cobro === "ha" && costoHa && Number.isNaN(leerNumero(costoHa)))
      faltan.push("El costo de la labor no es un número válido.");
    if (cobro === "hora" && [horas, costoHora].some((v) => v && Number.isNaN(leerNumero(v))))
      faltan.push("Revisá las horas y el costo por hora.");
    if (modalidad === "contratista" && !contratista.trim()) faltan.push("Escribí el contratista.");
    const datosAplicacion = {
      caudalLHa: opcional(aplicacion.caudalLHa),
      temperatura: opcional(aplicacion.temperatura),
      humedad: opcional(aplicacion.humedad),
      vientoKmH: opcional(aplicacion.vientoKmH),
      vientoDireccion: aplicacion.vientoDireccion || null,
      aplicador: aplicacion.aplicador || null,
    };
    if (Object.values(datosAplicacion).some((v) => typeof v === "number" && Number.isNaN(v)))
      faltan.push("Revisá los datos de la aplicación (caudal, temperatura, humedad, viento).");
    for (const l of lineas) {
      const nombre = productos.find((p) => p.id === l.productoId)?.nombre;
      if (!(leerNumero(l.dosis) > 0)) faltan.push(`Falta la dosis de ${nombre}.`);
      if (!(leerNumero(l.precio) >= 0)) faltan.push(`Falta el precio de ${nombre}.`);
    }
    setErrores(faltan);
    if (faltan.length) {
      setAviso("");
      setGuardadaId(null);
      return;
    }

    const descripcion = `${tipo!.nombre} en ${lote!.codigo} ${lote!.nombre}`;
    iniciarGuardado(async () => {
      const resultado = await guardarLabor(
        {
          loteId: lote!.id,
          fecha,
          tipoLaborId: tipo!.id,
          ha: haNum,
          modalidad: modalidad || null,
          contratista: modalidad === "contratista" ? contratista : null,
          cobro,
          costoLaborHa: costoHa ? leerNumero(costoHa) : null,
          horas: horas ? leerNumero(horas) : null,
          costoHora: costoHora ? leerNumero(costoHora) : null,
          aporte: aporte || null,
          notas: notas || null,
          aplicacion: datosAplicacion,
          zonas: enManchones && completas(zonas).length ? completas(zonas) : null,
          recetaId: recetaId ? Number(recetaId) : null,
          extras: formulario.current ? leerExtras(new FormData(formulario.current)) : {},
          descontarStock,
          insumos: lineas.map((l) => ({
            productoId: l.productoId,
            dosis: leerNumero(l.dosis),
            precio: leerNumero(l.precio),
          })),
        },
        laborId,
      );
      if (resultado.ok && !resultado.demo && (editando || inicial?.insumos)) {
        // Al editar o duplicar se vuelve al historial, donde se ve el cambio.
        router.push("/historial");
        return;
      }
      if (resultado.ok) {
        setGuardadaId(resultado.id ?? null);
        setAviso(`Se guardó: ${descripcion}${resultado.demo ? " (modo demo: no se guardó en la base)" : ""}.`);
        if (!editando) limpiar(cargarOtra);
      } else {
        setErrores([resultado.error]);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <>
      <form
        ref={formulario}
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
        className="flex flex-col gap-4 p-4 pb-44 md:grid md:grid-cols-[1fr_1.2fr] md:items-start md:p-0 md:pb-28"
      >
        {(errores.length > 0 || aviso) && (
          <div
            role={errores.length ? "alert" : "status"}
            className={cn(
              "rounded-xl border p-3 text-sm md:col-span-2",
              errores.length
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "bg-zafiro-suave border-zafiro/30 text-primary",
            )}
          >
            {errores.length ? (
              <ul className="list-disc pl-4">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{aviso}</span>
                {guardadaId && (
                  <a
                    href={`/historial/${guardadaId}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-primary text-primary-foreground flex h-9 items-center gap-1.5 rounded-lg px-3 font-bold"
                  >
                    <FileDown className="size-4" aria-hidden />
                    PDF para el cliente
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <section className="bg-card flex flex-col gap-3 rounded-xl border p-4">
          <label className={etiqueta}>
            Lote *
            <select className={entrada} value={loteId} onChange={(e) => elegirLote(e.target.value)} required>
              <option value="">Elegí un lote…</option>
              {campos.map((c) => (
                <optgroup key={c.id} label={c.nombre}>
                  {lotes
                    .filter((l) => l.campoId === c.id)
                    .map((l) => (
                      // Sin cultivo en curso no se puede registrar (hay que iniciarlo en la ficha del lote).
                      <option key={l.id} value={l.id} disabled={!l.cicloId && String(l.id) !== loteId}>
                        {l.codigo} · {l.nombre} ({num(l.ha, 0)} ha){l.cicloId ? "" : " · sin cultivo"}
                      </option>
                    ))}
                </optgroup>
              ))}
              <option value={NUEVO}>+ Nuevo lote…</option>
            </select>
            {lote && <span className="text-muted-foreground text-xs font-normal">Cultivo: {lote.cultivo}</span>}
          </label>

          {recetasDelLote.length > 0 && (
            <label className={etiqueta}>
              Receta
              <select className={entrada} value={recetaId} onChange={(e) => elegirReceta(e.target.value)}>
                <option value="">Sin receta</option>
                {recetasDelLote.map((r) => (
                  <option key={r.id} value={r.id}>
                    N° {r.numero} · {fechaCorta(r.fecha)}
                    {r.objetivo ? ` · ${r.objetivo}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground text-xs font-normal">Va en el PDF de la labor.</span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={etiqueta}>
              Fecha *
              <input
                type="date"
                className={entrada}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </label>
            <label className={etiqueta}>
              Labor *
              <select className={entrada} value={tipoId} onChange={(e) => elegirTipo(e.target.value)} required>
                <option value="">Elegí…</option>
                {tiposLabor.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
                <option value={NUEVO}>+ Nueva labor…</option>
              </select>
            </label>
          </div>
          {tipo && (
            <p className="text-muted-foreground -mt-1 text-xs">
              Tarifa: {tipo.detalle} = {usd2(tipo.tarifa)} USD/ha
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={etiqueta}>
              Hectáreas *
              <input
                className={entrada}
                inputMode="decimal"
                value={ha}
                onChange={(e) => setHa(e.target.value)}
                required
              />
              {lote && haNum !== lote.ha && (
                <span className="text-muted-foreground text-xs font-normal">Del lote: {num(lote.ha)} ha</span>
              )}
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-bold">Se cobra</legend>
              <Opciones
                opciones={[
                  ["ha", "Por ha"],
                  ["hora", "Por hora"],
                ]}
                valor={cobro}
                alCambiar={setCobro}
              />
            </fieldset>
          </div>

          {lote && mapas[lote.campoId] && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enManchones}
                  onChange={(e) => setEnManchones(e.target.checked)}
                  className="size-5"
                />
                Se aplicó en manchones (marcarlos en el mapa)
              </label>
              {enManchones && (
                <EditorDibujo
                  foto={mapas[lote.campoId]}
                  fondo={lotes.filter((l) => l.campoId === lote.campoId)}
                  figuras={zonas}
                  multiple
                  alCambiar={setZonas}
                />
              )}
            </div>
          )}

          {cobro === "ha" ? (
            <label className={etiqueta}>
              Costo labor USD/ha
              <input
                className={entrada}
                inputMode="decimal"
                value={costoHa}
                onChange={(e) => setCostoHa(e.target.value)}
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className={etiqueta}>
                Horas
                <input className={entrada} inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} />
              </label>
              <label className={etiqueta}>
                USD por hora
                <input
                  className={entrada}
                  inputMode="decimal"
                  value={costoHora}
                  onChange={(e) => setCostoHora(e.target.value)}
                />
              </label>
            </div>
          )}

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-bold">¿Quién la hizo?</legend>
            <Opciones
              opciones={[
                ["", "Sin dato"],
                ["propia", "Máquina propia"],
                ["contratista", "Contratista"],
              ]}
              valor={modalidad}
              alCambiar={setModalidad}
            />
          </fieldset>
          {modalidad === "contratista" && (
            <label className={etiqueta}>
              Contratista *
              <input
                className={entrada}
                list="contratistas"
                value={contratista}
                onChange={(e) => setContratista(e.target.value)}
                placeholder="Elegí o escribí uno nuevo"
              />
              <datalist id="contratistas">
                {contratistas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          )}

          <label className={etiqueta}>
            Aporte
            <input
              className={entrada}
              list="aportes"
              value={aporte}
              onChange={(e) => setAporte(e.target.value)}
              placeholder="Elegí o escribí uno nuevo"
            />
            <datalist id="aportes">
              {aportes.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>

          <label className={etiqueta}>
            Observaciones
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Plaga objetivo, condiciones, etc."
              className="bg-card border-input focus:border-ring rounded-lg border p-3 font-normal outline-none"
            />
          </label>

          <MasDatos abierto={Boolean(inicial?.aplicacion && Object.values(inicial.aplicacion).some((v) => v !== null))}>
            <p className="text-muted-foreground -mt-1 text-xs">Datos de la aplicación</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["caudalLHa", "Caudal (L/ha)"],
                  ["temperatura", "Temperatura (°C)"],
                  ["humedad", "Humedad (%)"],
                  ["vientoKmH", "Viento (km/h)"],
                ] as const
              ).map(([clave, texto]) => (
                <label key={clave} className={etiqueta}>
                  {texto}
                  <input
                    className={entrada}
                    inputMode="decimal"
                    value={aplicacion[clave]}
                    onChange={(e) => setAplicacion({ ...aplicacion, [clave]: e.target.value })}
                  />
                </label>
              ))}
              <label className={etiqueta}>
                Dirección del viento
                <input
                  className={entrada}
                  value={aplicacion.vientoDireccion}
                  onChange={(e) => setAplicacion({ ...aplicacion, vientoDireccion: e.target.value })}
                  placeholder="Ej. NE"
                />
              </label>
              <label className={etiqueta}>
                Aplicador
                <input
                  className={entrada}
                  value={aplicacion.aplicador}
                  onChange={(e) => setAplicacion({ ...aplicacion, aplicador: e.target.value })}
                />
              </label>
            </div>
            <div key={vueltaExtras} className="flex flex-col gap-3">
              <CamposExtra campos={extrasLabor} valores={inicial?.extras} etiqueta={etiqueta} entrada={entrada} />
            </div>
          </MasDatos>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Productos</h2>
            <span className="text-muted-foreground text-xs">
              {lineas.length === 0 ? "Opcional (ej. rastra o siembra sin insumos)" : `${lineas.length} productos`}
            </span>
          </div>

          {lineas.map((l) => {
            const p = productos.find((x) => x.id === l.productoId)!;
            const totalLinea = (leerNumero(l.dosis) || 0) * (leerNumero(l.precio) || 0) * haNum;
            return (
              <div key={l.clave} className="bg-card flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{p.nombre}</p>
                    <p className="text-muted-foreground text-xs">
                      {NOMBRE_CATEGORIA[p.categoria]} · {p.unidad}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineas((previas) => previas.filter((x) => x.clave !== l.clave))}
                    aria-label={`Quitar ${p.nombre}`}
                    className="text-muted-foreground hover:bg-muted hover:text-destructive -m-1 flex size-10 items-center justify-center rounded-lg"
                  >
                    <Trash2 className="size-[18px]" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-3 items-end gap-2">
                  <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                    Dosis {p.unidad}/ha *
                    <input
                      className={cn(entrada, "h-10 text-foreground")}
                      inputMode="decimal"
                      value={l.dosis}
                      onChange={(e) => cambiarLinea(l.clave, { dosis: e.target.value })}
                      autoFocus={l.clave === recienAgregada}
                    />
                  </label>
                  <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                    USD/{p.unidad} *
                    <input
                      className={cn(entrada, "h-10 text-foreground")}
                      inputMode="decimal"
                      value={l.precio}
                      onChange={(e) => cambiarLinea(l.clave, { precio: e.target.value })}
                    />
                  </label>
                  <p className="text-muted-foreground text-right text-xs">
                    {num((leerNumero(l.dosis) || 0) * haNum)} {p.unidad}
                    <span className="text-foreground block text-base font-bold tabular-nums">{usd2(totalLinea)}</span>
                  </p>
                </div>
                {lote && descontarStock && (
                  <StockLinea disponible={stockDe(p.id)} usa={(leerNumero(l.dosis) || 0) * haNum} unidad={p.unidad} />
                )}
              </div>
            );
          })}

          <label className="border-zafiro text-zafiro bg-card flex flex-col gap-1 rounded-xl border-2 border-dashed p-3 text-sm font-bold">
            + Agregar producto
            <select
              className={cn(entrada, "text-foreground")}
              value={agregar}
              onChange={(e) => agregarProducto(e.target.value)}
            >
              <option value="">Elegí un producto…</option>
              {Object.entries(NOMBRE_CATEGORIA).map(([categoria, nombre]) => {
                const deLaCategoria = productos.filter((p) => p.categoria === categoria);
                if (!deLaCategoria.length) return null;
                return (
                  <optgroup key={categoria} label={nombre}>
                    {deLaCategoria.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({usd2(p.precio)} USD/{p.unidad})
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              <option value={NUEVO}>+ Nuevo insumo (no está en la lista)…</option>
            </select>
          </label>

          {lineas.length > 0 && (
            <label className="flex items-center gap-2 px-1 text-sm">
              <input
                type="checkbox"
                checked={descontarStock}
                onChange={(e) => setDescontarStock(e.target.checked)}
                className="size-5"
              />
              Descontar los productos del stock del campo
            </label>
          )}
        </section>

        <footer className="bg-card fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-60 md:flex-row md:items-center md:justify-end md:gap-6 md:px-8">
          <div className="flex items-baseline justify-between gap-4 md:mr-auto">
            <p className="text-muted-foreground text-sm">
              Insumos {usd2(costoInsumos)} · Labor {usd2(costoTrabajo)}
            </p>
            <p className="text-right">
              <span className="block text-xl font-black tabular-nums">USD {usd2(total)}</span>
              <span className="text-muted-foreground block text-xs">{usd2(haNum ? total / haNum : 0)} USD/ha</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            {editando ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-card hover:bg-muted h-12 rounded-xl border px-4 text-sm font-bold"
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => guardar(true)}
                disabled={guardando}
                className="bg-card hover:bg-muted h-12 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"
              >
                Guardar y cargar otra
              </button>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="bg-primary text-primary-foreground h-12 rounded-xl px-8 font-bold disabled:opacity-50"
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </footer>
      </form>

      {/* Altas en el momento: fuera del <form> porque un formulario no puede ir dentro de otro. */}
      <Dialogo abierto={alta === "lote"} alCerrar={() => setAlta(null)} titulo="Nuevo lote">
        <FormLote campos={campos} personalizados={personalizados} alGuardar={terminarAlta("lote")} />
      </Dialogo>
      <Dialogo abierto={alta === "labor"} alCerrar={() => setAlta(null)} titulo="Nuevo tipo de labor">
        <FormTipoLabor alGuardar={terminarAlta("labor")} />
      </Dialogo>
      <Dialogo abierto={alta === "producto"} alCerrar={() => setAlta(null)} titulo="Nuevo insumo">
        <FormProducto personalizados={personalizados} alGuardar={terminarAlta("producto")} />
      </Dialogo>
    </>
  );
}

/** Botones de opción (radio) con el mismo estilo que el resto de los formularios. */
function Opciones<T extends string>({
  opciones,
  valor,
  alCambiar,
}: {
  opciones: [T, string][];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border p-1">
      {opciones.map(([v, texto]) => (
        <button
          key={v || "nada"}
          type="button"
          aria-pressed={valor === v}
          onClick={() => alCambiar(v)}
          className={cn(
            "h-9 flex-1 rounded-md px-2 text-sm font-bold",
            valor === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function StockLinea({ disponible, usa, unidad }: { disponible: number; usa: number; unidad: string }) {
  const queda = disponible - usa;
  return (
    <p className={cn("text-xs", queda < 0 ? "text-destructive" : "text-muted-foreground")}>
      Stock en el campo: {num(disponible)} {unidad}
      {usa > 0 && ` · quedan ${num(queda)} ${unidad}`}
      {queda < 0 && " (no alcanza: queda en negativo)"}
    </p>
  );
}
