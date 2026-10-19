"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { Campo, Lote, Producto } from "@/lib/datos";
import type { Orden } from "@/lib/ordenes";
import type { RecetaOpcion } from "../registrar/formulario-labor";
import { MasDatos, areaTexto, entrada, etiqueta } from "@/components/app/altas";
import { NOMBRE_CATEGORIA, fechaCorta, hoyIso, leerNumero, num, numeroEditable, usd2 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { guardarOrden } from "./acciones";

type Linea = { clave: number; productoId: number; dosis: string; precio: string };
type LineaGasto = { clave: number; concepto: string; importe: string };
type TipoLaborOpcion = { id: number; nombre: string; tarifa: number };

const opcional = (t: string) => (t.trim() ? leerNumero(t) : null);
const editable = (v: number | null | undefined) => (v == null ? "" : numeroEditable(v));
const GASTOS_SUGERIDOS = ["Flete", "Alquiler de equipo", "Gasoil", "Viáticos"];

export function FormularioOrden({
  campos,
  lotes,
  productos,
  tiposLabor,
  contratistas,
  recetas,
  inicial,
  loteInicial,
  recetaInicial,
}: {
  campos: Campo[];
  lotes: Lote[];
  productos: Producto[];
  tiposLabor: TipoLaborOpcion[];
  contratistas: string[];
  recetas: RecetaOpcion[];
  /** Si viene, se edita esa orden. */
  inicial?: Orden;
  loteInicial?: number;
  /** Arrancar desde una receta: toma su lote y sus productos. */
  recetaInicial?: number;
}) {
  const router = useRouter();
  const desdeReceta = recetas.find((r) => r.id === recetaInicial);
  const loteDeInicio = inicial?.loteId ?? desdeReceta?.loteId ?? loteInicial;
  const precioDe = (id: number) => productos.find((p) => p.id === id)?.precio ?? 0;

  const [loteId, setLoteId] = useState(String(loteDeInicio ?? ""));
  const [ha, setHa] = useState(
    inicial ? numeroEditable(inicial.ha) : editable(lotes.find((l) => l.id === loteDeInicio)?.ha),
  );
  const [tipoId, setTipoId] = useState(inicial?.tipoLaborId ? String(inicial.tipoLaborId) : "");
  const [recetaId, setRecetaId] = useState(String(inicial?.recetaId ?? desdeReceta?.id ?? ""));
  const [modalidad, setModalidad] = useState<"propia" | "contratista" | "">(inicial?.modalidad ?? "");
  const [contratista, setContratista] = useState(inicial?.contratista ?? "");
  const [cobro, setCobro] = useState<"ha" | "hora">(inicial?.cobro ?? "ha");
  const [costoHa, setCostoHa] = useState(editable(inicial?.costoLaborHa));
  const [horas, setHoras] = useState(editable(inicial?.horas));
  const [costoHora, setCostoHora] = useState(editable(inicial?.costoHora));
  const [lineas, setLineas] = useState<Linea[]>(() =>
    inicial
      ? inicial.items.map((i, n) => ({ clave: n, productoId: i.productoId, dosis: numeroEditable(i.dosis), precio: numeroEditable(i.precio) }))
      : (desdeReceta?.items ?? []).map((i, n) => ({
          clave: n,
          productoId: i.productoId,
          dosis: numeroEditable(i.dosis),
          precio: numeroEditable(precioDe(i.productoId)),
        })),
  );
  const [gastos, setGastos] = useState<LineaGasto[]>(
    () => inicial?.gastos.map((g, n) => ({ clave: n, concepto: g.concepto, importe: numeroEditable(g.importe) })) ?? [],
  );
  const [mostrarCostos, setMostrarCostos] = useState(inicial?.mostrarCostos ?? true);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, iniciar] = useTransition();

  const lote = lotes.find((l) => String(l.id) === loteId);
  const recetasDelLote = recetas.filter((r) => String(r.loteId) === loteId);
  const haNum = leerNumero(ha) || 0;
  const costoInsumos = lineas.reduce((t, l) => t + (leerNumero(l.dosis) || 0) * (leerNumero(l.precio) || 0) * haNum, 0);
  const costoTrabajo =
    cobro === "hora" ? (leerNumero(horas) || 0) * (leerNumero(costoHora) || 0) : (leerNumero(costoHa) || 0) * haNum;
  const costoOtros = gastos.reduce((t, g) => t + (leerNumero(g.importe) || 0), 0);
  const total = costoInsumos + costoTrabajo + costoOtros;

  function elegirLote(id: string) {
    setLoteId(id);
    // La receta es de un lote: si se cambia de lote, deja de valer.
    if (!recetas.some((r) => String(r.id) === recetaId && String(r.loteId) === id)) setRecetaId("");
    const nuevo = lotes.find((l) => String(l.id) === id);
    if (nuevo) setHa(numeroEditable(nuevo.ha));
  }

  function elegirTipo(id: string) {
    setTipoId(id);
    const tipo = tiposLabor.find((t) => String(t.id) === id);
    if (tipo) setCostoHa(numeroEditable(Math.round(tipo.tarifa * 100) / 100));
  }

  function elegirReceta(id: string) {
    setRecetaId(id);
    const receta = recetas.find((r) => String(r.id) === id);
    // Si todavía no hay productos, se cargan los de la receta (con el precio de lista).
    if (!receta || lineas.length) return;
    setLineas(
      receta.items.map((i, n) => ({
        clave: Date.now() + n,
        productoId: i.productoId,
        dosis: numeroEditable(i.dosis),
        precio: numeroEditable(precioDe(i.productoId)),
      })),
    );
  }

  function agregarProducto(id: string) {
    const p = productos.find((x) => String(x.id) === id);
    if (p) setLineas((ls) => [...ls, { clave: Date.now(), productoId: p.id, dosis: "", precio: numeroEditable(p.precio) }]);
  }

  const cambiarLinea = (clave: number, cambio: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
  const cambiarGasto = (clave: number, cambio: Partial<LineaGasto>) =>
    setGastos((gs) => gs.map((g) => (g.clave === clave ? { ...g, ...cambio } : g)));

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campo = (n: string) => String(f.get(n) ?? "");
    const faltan: string[] = [];
    if (!lote) faltan.push("Elegí el lote.");
    if (!(haNum > 0)) faltan.push("La superficie tiene que ser un número mayor a 0.");
    if (modalidad === "contratista" && !contratista.trim()) faltan.push("Escribí el contratista.");
    const numeros = cobro === "ha" ? [costoHa] : [horas, costoHora];
    if (numeros.some((v) => v.trim() && !(leerNumero(v) >= 0))) faltan.push("Revisá el costo de la labor.");
    for (const l of lineas) {
      const nombre = productos.find((p) => p.id === l.productoId)?.nombre;
      if (!(leerNumero(l.dosis) > 0)) faltan.push(`Falta la dosis de ${nombre}.`);
      if (!(leerNumero(l.precio) >= 0)) faltan.push(`Falta el precio de ${nombre}.`);
    }
    for (const g of gastos)
      if (!g.concepto.trim() || !(leerNumero(g.importe) >= 0)) faltan.push("Completá el concepto y el importe de cada gasto.");
    setErrores([...new Set(faltan)]);
    if (faltan.length) return window.scrollTo({ top: 0, behavior: "smooth" });

    iniciar(async () => {
      const r = await guardarOrden(
        {
          loteId: lote!.id,
          fecha: campo("fecha"),
          estado: (campo("estado") || "pendiente") as Orden["estado"],
          recetaId: recetaId ? Number(recetaId) : null,
          tipoLaborId: tipoId ? Number(tipoId) : null,
          fechaPrevista: campo("fechaPrevista"),
          ha: haNum,
          modalidad: modalidad || null,
          contratista: modalidad === "contratista" ? contratista : null,
          cobro,
          costoLaborHa: cobro === "ha" ? opcional(costoHa) : null,
          horas: cobro === "hora" ? opcional(horas) : null,
          costoHora: cobro === "hora" ? opcional(costoHora) : null,
          instrucciones: campo("instrucciones"),
          observaciones: campo("observaciones"),
          mostrarCostos,
          items: lineas.map((l) => ({ productoId: l.productoId, dosis: leerNumero(l.dosis), precio: leerNumero(l.precio) })),
          gastos: gastos.map((g) => ({ concepto: g.concepto, importe: leerNumero(g.importe) })),
        },
        inicial?.id,
      );
      if (!r.ok) {
        setErrores([r.error]);
        return window.scrollTo({ top: 0, behavior: "smooth" });
      }
      router.push(r.id ? `/ordenes/${r.id}` : "/ordenes");
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 p-4 pb-28 md:grid md:grid-cols-2 md:items-start md:p-0">
      {errores.length > 0 && (
        <ul
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive list-disc rounded-xl border p-3 pl-7 text-sm md:col-span-2"
        >
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
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
                    <option key={l.id} value={l.id} disabled={!l.cicloId && String(l.id) !== loteId}>
                      {l.codigo} · {l.nombre} ({num(l.ha, 0)} ha){l.cicloId ? "" : " · sin cultivo"}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {lote && <span className="text-muted-foreground text-xs font-normal">Cultivo: {lote.cultivo || "sin cargar"}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Fecha de la orden *
            <input name="fecha" type="date" className={entrada} defaultValue={inicial?.fecha ?? hoyIso()} required />
          </label>
          <label className={etiqueta}>
            Hacer el
            <input name="fechaPrevista" type="date" className={entrada} defaultValue={inicial?.fechaPrevista ?? ""} />
          </label>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className={etiqueta}>
            Labor
            <select className={entrada} value={tipoId} onChange={(e) => elegirTipo(e.target.value)}>
              <option value="">Elegí la labor…</option>
              {tiposLabor.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={etiqueta}>
            Superficie (ha) *
            <input className={entrada} inputMode="decimal" value={ha} onChange={(e) => setHa(e.target.value)} required />
          </label>
        </div>
        {lote && (
          <label className={etiqueta}>
            Receta
            <select className={entrada} value={recetaId} onChange={(e) => elegirReceta(e.target.value)}>
              <option value="">{recetasDelLote.length ? "Sin receta" : "Este lote no tiene recetas"}</option>
              {recetasDelLote.map((r) => (
                <option key={r.id} value={r.id}>
                  N° {r.numero} · {fechaCorta(r.fecha)}
                  {r.objetivo ? ` · ${r.objetivo}` : ""}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-xs font-normal">
              La receta sale completa en el PDF de la orden (y la oficial, si está cargada).
            </span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            La hace
            <select
              className={entrada}
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as "propia" | "contratista" | "")}
            >
              <option value="">Sin definir</option>
              <option value="propia">Máquina propia</option>
              <option value="contratista">Contratista</option>
            </select>
          </label>
          <label className={etiqueta}>
            Se cobra
            <select className={entrada} value={cobro} onChange={(e) => setCobro(e.target.value as "ha" | "hora")}>
              <option value="ha">Por ha</option>
              <option value="hora">Por hora</option>
            </select>
          </label>
        </div>
        {modalidad === "contratista" && (
          <label className={etiqueta}>
            Contratista *
            <input
              className={entrada}
              list="contratistas-orden"
              value={contratista}
              onChange={(e) => setContratista(e.target.value)}
            />
            <datalist id="contratistas-orden">
              {contratistas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        )}
        {cobro === "ha" ? (
          <label className={etiqueta}>
            Costo de la labor (USD/ha)
            <input className={entrada} inputMode="decimal" value={costoHa} onChange={(e) => setCostoHa(e.target.value)} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={etiqueta}>
              Horas estimadas
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
        <label className={etiqueta}>
          Instrucciones
          <textarea
            name="instrucciones"
            rows={3}
            className={areaTexto}
            defaultValue={inicial?.instrucciones ?? ""}
            placeholder="Qué hay que hacer y cómo: caudal, pastillas, horario, cuidados…"
          />
        </label>
        <MasDatos abierto={Boolean(inicial?.observaciones)}>
          <label className={etiqueta}>
            Observaciones
            <textarea name="observaciones" rows={2} className={areaTexto} defaultValue={inicial?.observaciones ?? ""} />
          </label>
          <label className={etiqueta}>
            Estado
            <select name="estado" className={entrada} defaultValue={inicial?.estado ?? "pendiente"}>
              <option value="pendiente">Pendiente</option>
              <option value="enviada">Enviada al productor</option>
              <option value="realizada">Realizada</option>
              <option value="anulada">Anulada</option>
            </select>
          </label>
        </MasDatos>
      </section>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Productos</h2>
          {lineas.map((l) => {
            const p = productos.find((x) => x.id === l.productoId)!;
            const dosis = leerNumero(l.dosis) || 0;
            const precio = leerNumero(l.precio) || 0;
            return (
              <div key={l.clave} className="bg-card flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{p.nombre}</p>
                    <p className="text-muted-foreground text-xs">{p.principioActivo || NOMBRE_CATEGORIA[p.categoria]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
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
                      className={cn(entrada, "text-foreground h-10")}
                      inputMode="decimal"
                      value={l.dosis}
                      onChange={(e) => cambiarLinea(l.clave, { dosis: e.target.value })}
                      autoFocus={!inicial && !desdeReceta}
                    />
                  </label>
                  <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                    USD/{p.unidad}
                    <input
                      className={cn(entrada, "text-foreground h-10")}
                      inputMode="decimal"
                      value={l.precio}
                      onChange={(e) => cambiarLinea(l.clave, { precio: e.target.value })}
                    />
                  </label>
                  <p className="text-muted-foreground text-right text-xs">
                    {num(dosis * haNum)} {p.unidad}
                    <span className="text-foreground block text-base font-bold tabular-nums">
                      USD {usd2(dosis * precio * haNum)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          <label className="border-zafiro text-zafiro bg-card flex flex-col gap-1 rounded-xl border-2 border-dashed p-3 text-sm font-bold">
            + Agregar producto
            <select className={cn(entrada, "text-foreground")} value="" onChange={(e) => agregarProducto(e.target.value)}>
              <option value="">Elegí un producto…</option>
              {Object.entries(NOMBRE_CATEGORIA).map(([categoria, nombre]) => {
                const lista = productos.filter((p) => p.categoria === categoria);
                if (!lista.length) return null;
                return (
                  <optgroup key={categoria} label={nombre}>
                    {lista.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Otros gastos</h2>
          {gastos.map((g) => (
            <div key={g.clave} className="bg-card grid grid-cols-[1fr_110px_auto] items-end gap-2 rounded-xl border p-3">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                Concepto
                <input
                  className={cn(entrada, "text-foreground h-10")}
                  list="gastos-orden"
                  value={g.concepto}
                  onChange={(e) => cambiarGasto(g.clave, { concepto: e.target.value })}
                  autoFocus={!g.concepto}
                />
              </label>
              <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                USD
                <input
                  className={cn(entrada, "text-foreground h-10")}
                  inputMode="decimal"
                  value={g.importe}
                  onChange={(e) => cambiarGasto(g.clave, { importe: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => setGastos((gs) => gs.filter((x) => x.clave !== g.clave))}
                aria-label={`Quitar ${g.concepto || "gasto"}`}
                className="text-muted-foreground hover:bg-muted hover:text-destructive flex size-10 items-center justify-center rounded-lg"
              >
                <Trash2 className="size-[18px]" aria-hidden />
              </button>
            </div>
          ))}
          <datalist id="gastos-orden">
            {GASTOS_SUGERIDOS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => setGastos((gs) => [...gs, { clave: Date.now(), concepto: "", importe: "" }])}
            className="border-zafiro text-zafiro bg-card h-12 rounded-xl border-2 border-dashed text-sm font-bold"
          >
            + Agregar gasto (flete, alquiler de equipo…)
          </button>
        </section>

        <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
          <h2 className="font-bold">Costo estimado</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-muted-foreground">Insumos</dt>
            <dd className="text-right">{usd2(costoInsumos)}</dd>
            <dt className="text-muted-foreground">Labor</dt>
            <dd className="text-right">{usd2(costoTrabajo)}</dd>
            <dt className="text-muted-foreground">Otros gastos</dt>
            <dd className="text-right">{usd2(costoOtros)}</dd>
            <dt className="font-bold">Total USD</dt>
            <dd className="text-right text-lg font-black">{usd2(total)}</dd>
            <dt className="text-muted-foreground">Por hectárea</dt>
            <dd className="text-right">{haNum ? usd2(total / haNum) : "—"} USD/ha</dd>
          </dl>
          <label className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="size-5"
              checked={mostrarCostos}
              onChange={(e) => setMostrarCostos(e.target.checked)}
            />
            Mostrar precios y costos en el PDF
          </label>
        </section>
      </div>

      <footer className="bg-card fixed inset-x-0 bottom-0 z-30 flex justify-end gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-60 md:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-card hover:bg-muted h-12 rounded-xl border px-4 text-sm font-bold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="bg-primary text-primary-foreground h-12 flex-1 rounded-xl px-8 font-bold disabled:opacity-50 md:flex-none"
        >
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar orden"}
        </button>
      </footer>
    </form>
  );
}
