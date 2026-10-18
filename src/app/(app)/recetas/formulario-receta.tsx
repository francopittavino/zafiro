"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileUp, Trash2 } from "lucide-react";
import type { Campo, CampoPersonalizado, Lote, Producto } from "@/lib/datos";
import type { Receta } from "@/lib/recetas";
import { MasDatos, areaTexto, entrada, etiqueta } from "@/components/app/altas";
import { CamposExtra, leerExtras } from "@/components/app/campos-extra";
import { NOMBRE_CATEGORIA, hoyIso, leerNumero, num, numeroEditable } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { guardarReceta, subirRecetaOficial } from "./acciones";

type Linea = { clave: number; productoId: number; dosis: string };

const TIPOS_APLICACION = ["Terrestre", "Aérea", "Dron", "Mochila"];
const opcional = (t: string) => (t.trim() ? leerNumero(t) : null);

export function FormularioReceta({
  campos,
  lotes,
  productos,
  personalizados,
  inicial,
  loteInicial,
}: {
  campos: Campo[];
  lotes: Lote[];
  productos: Producto[];
  personalizados: CampoPersonalizado[];
  /** Si viene, se edita esa receta. */
  inicial?: Receta;
  loteInicial?: number;
}) {
  const router = useRouter();
  const [loteId, setLoteId] = useState(String(inicial?.loteId ?? loteInicial ?? ""));
  const [superficie, setSuperficie] = useState(
    inicial?.superficieHa != null
      ? numeroEditable(inicial.superficieHa)
      : numeroEditable(lotes.find((l) => l.id === (inicial?.loteId ?? loteInicial))?.ha ?? 0).replace(/^0$/, ""),
  );
  const [lineas, setLineas] = useState<Linea[]>(
    () => inicial?.items.map((i, n) => ({ clave: n, productoId: i.productoId, dosis: numeroEditable(i.dosis) })) ?? [],
  );
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, iniciar] = useTransition();
  /** PDF de la receta oficial de la provincia: se sube después de guardar la receta. */
  const [oficial, setOficial] = useState<File | null>(null);
  const lote = lotes.find((l) => String(l.id) === loteId);
  const haNum = leerNumero(superficie) || 0;
  const extras = personalizados.filter((c) => c.entidad === "receta");

  function elegirLote(id: string) {
    setLoteId(id);
    const nuevo = lotes.find((l) => String(l.id) === id);
    if (nuevo) setSuperficie(numeroEditable(nuevo.ha));
  }

  function agregar(id: string) {
    const p = productos.find((x) => String(x.id) === id);
    if (p) setLineas((ls) => [...ls, { clave: Date.now(), productoId: p.id, dosis: "" }]);
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campo = (n: string) => String(f.get(n) ?? "");
    const faltan: string[] = [];
    if (!lote) faltan.push("Elegí el lote.");
    const ha = opcional(superficie);
    const caudal = opcional(campo("caudal"));
    if (ha !== null && !(ha > 0)) faltan.push("La superficie tiene que ser un número mayor a 0.");
    if (caudal !== null && !(caudal > 0)) faltan.push("El caudal tiene que ser un número mayor a 0.");
    for (const l of lineas)
      if (!(leerNumero(l.dosis) > 0)) faltan.push(`Falta la dosis de ${productos.find((p) => p.id === l.productoId)?.nombre}.`);
    setErrores(faltan);
    if (oficial && oficial.type !== "application/pdf") faltan.push("La receta oficial tiene que ser un PDF.");
    if (oficial && oficial.size > 10 * 1024 * 1024) faltan.push("El PDF de la receta oficial pesa más de 10 MB.");
    if (faltan.length) return window.scrollTo({ top: 0, behavior: "smooth" });

    iniciar(async () => {
      const r = await guardarReceta(
        {
          loteId: lote!.id,
          fecha: campo("fecha"),
          estado: campo("estado") as "borrador",
          numeroOficial: campo("numeroOficial"),
          superficieHa: ha,
          plagaObjetivo: campo("plagaObjetivo"),
          tipoAplicacion: campo("tipoAplicacion"),
          caudalLHa: caudal,
          fechaAplicacionPrevista: campo("fechaAplicacionPrevista"),
          condiciones: campo("condiciones"),
          recomendaciones: campo("recomendaciones"),
          observaciones: campo("observaciones"),
          extras: leerExtras(f),
          items: lineas.map((l) => ({ productoId: l.productoId, dosis: leerNumero(l.dosis) })),
        },
        inicial?.id,
      );
      if (!r.ok) {
        setErrores([r.error]);
        return window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (r.id && oficial) {
        const datos = new FormData();
        datos.set("recetaId", String(r.id));
        datos.set("archivo", oficial);
        const subida = await subirRecetaOficial(datos);
        // La receta ya quedó guardada: el PDF se puede volver a subir desde su ficha.
        if (!subida.ok) window.alert(`La receta se guardó, pero el PDF oficial no: ${subida.error}`);
      }
      router.push(r.id ? `/recetas/${r.id}` : "/recetas");
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
            Fecha *
            <input name="fecha" type="date" className={entrada} defaultValue={inicial?.fecha ?? hoyIso()} required />
          </label>
          <label className={etiqueta}>
            Superficie (ha)
            <input
              className={entrada}
              inputMode="decimal"
              value={superficie}
              onChange={(e) => setSuperficie(e.target.value)}
            />
          </label>
        </div>
        <label className={etiqueta}>
          Plaga, maleza o enfermedad objetivo
          <input name="plagaObjetivo" className={entrada} defaultValue={inicial?.plagaObjetivo ?? ""} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Tipo de aplicación
            <input
              name="tipoAplicacion"
              className={entrada}
              list="tipos-aplicacion"
              defaultValue={inicial?.tipoAplicacion ?? ""}
            />
            <datalist id="tipos-aplicacion">
              {TIPOS_APLICACION.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className={etiqueta}>
            Caudal (L/ha)
            <input
              name="caudal"
              className={entrada}
              inputMode="decimal"
              defaultValue={inicial?.caudalLHa != null ? numeroEditable(inicial.caudalLHa) : ""}
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">Receta oficial de la provincia (PDF)</p>
          <label className="bg-card hover:bg-muted flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <FileUp className="text-zafiro size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {oficial
                ? oficial.name
                : inicial?.archivoOficial
                  ? "Ya está cargada: elegí otro PDF para reemplazarla"
                  : "Elegí el PDF de la receta oficial"}
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setOficial(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-muted-foreground text-xs">Al exportar, sale pegada al resumen en el mismo PDF.</p>
        </div>
        <label className={etiqueta}>
          Recomendaciones
          <textarea name="recomendaciones" rows={3} className={areaTexto} defaultValue={inicial?.recomendaciones ?? ""} />
        </label>
        <MasDatos abierto={Boolean(inicial?.numeroOficial || inicial?.condiciones || inicial?.observaciones)}>
          <div className="grid grid-cols-2 gap-3">
            <label className={etiqueta}>
              N° receta oficial
              <input name="numeroOficial" className={entrada} defaultValue={inicial?.numeroOficial ?? ""} />
            </label>
            <label className={etiqueta}>
              Aplicar a partir del
              <input
                name="fechaAplicacionPrevista"
                type="date"
                className={entrada}
                defaultValue={inicial?.fechaAplicacionPrevista ?? ""}
              />
            </label>
          </div>
          <label className={etiqueta}>
            Condiciones y distancias
            <textarea
              name="condiciones"
              rows={2}
              className={areaTexto}
              defaultValue={inicial?.condiciones ?? ""}
              placeholder="Viento, temperatura, distancia a zonas urbanas, escuelas o cursos de agua"
            />
          </label>
          <label className={etiqueta}>
            Observaciones
            <textarea name="observaciones" rows={2} className={areaTexto} defaultValue={inicial?.observaciones ?? ""} />
          </label>
          <CamposExtra campos={extras} valores={inicial?.extras} etiqueta={etiqueta} entrada={entrada} />
          <label className={etiqueta}>
            Estado
            <select name="estado" className={entrada} defaultValue={inicial?.estado ?? "emitida"}>
              <option value="borrador">Borrador</option>
              <option value="emitida">Emitida</option>
              <option value="aplicada">Aplicada</option>
              <option value="anulada">Anulada</option>
            </select>
          </label>
        </MasDatos>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Productos</h2>
        {lineas.map((l) => {
          const p = productos.find((x) => x.id === l.productoId)!;
          const dosis = leerNumero(l.dosis) || 0;
          return (
            <div key={l.clave} className="bg-card flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{p.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {[p.principioActivo, p.bandaToxicologica && `Banda ${p.bandaToxicologica}`].filter(Boolean).join(" · ") ||
                      NOMBRE_CATEGORIA[p.categoria]}
                  </p>
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
              <div className="grid grid-cols-2 items-end gap-2">
                <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                  Dosis {p.unidad}/ha *
                  <input
                    className={cn(entrada, "text-foreground h-10")}
                    inputMode="decimal"
                    value={l.dosis}
                    onChange={(e) =>
                      setLineas((ls) => ls.map((x) => (x.clave === l.clave ? { ...x, dosis: e.target.value } : x)))
                    }
                    autoFocus={!inicial}
                  />
                </label>
                <p className="text-muted-foreground text-right text-xs">
                  Total para {num(haNum)} ha
                  <span className="text-foreground block text-base font-bold tabular-nums">
                    {num(dosis * haNum)} {p.unidad}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
        <label className="border-zafiro text-zafiro bg-card flex flex-col gap-1 rounded-xl border-2 border-dashed p-3 text-sm font-bold">
          + Agregar producto
          <select className={cn(entrada, "text-foreground")} value="" onChange={(e) => agregar(e.target.value)}>
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
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar receta"}
        </button>
      </footer>
    </form>
  );
}
