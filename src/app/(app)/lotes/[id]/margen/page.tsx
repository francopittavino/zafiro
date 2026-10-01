import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { BotonImprimir } from "@/components/app/boton-imprimir";
import { margenDelLote } from "@/lib/consultas";
import { num, usd, usd2 } from "@/lib/formato";

const campo = "flex flex-col gap-1 text-sm font-bold";
const entrada = "bg-card h-11 rounded-lg border border-input px-3 font-normal";

export default async function MargenBruto({ params }: PageProps<"/lotes/[id]/margen">) {
  const { id } = await params;
  const datos = await margenDelLote(Number(id));
  if (!datos) notFound();

  const { lote, cosecha, costos, resultado: r } = datos;
  const filas = [
    { texto: "Ingreso bruto", valor: r.ingresoBruto, fuerte: true },
    { texto: "− Comercialización", valor: r.comercializacion },
    { texto: "− Flete", valor: r.flete },
    { texto: "Ingreso neto", valor: r.ingresoNeto, fuerte: true, separador: true },
    { texto: "− Insumos", valor: costos.insumos },
    { texto: "− Labores", valor: costos.labores },
    { texto: "− Cosecha", valor: costos.cosecha },
  ];
  const barras = [
    { texto: "Insumos", valor: costos.insumos },
    { texto: "Labores", valor: costos.labores },
    { texto: "Cosecha", valor: costos.cosecha },
    { texto: "Comerc. + flete", valor: r.comercializacion + r.flete },
  ];
  const maxTn = Math.max(...barras.map((b) => r.tnHa(b.valor)), r.tnHa(r.margen), 0.01);

  return (
    <>
      <Encabezado
        volver={`/lotes/${lote.id}`}
        titulo="Margen bruto"
        subtitulo={`${lote.codigo} ${lote.nombre} · ${lote.cultivo} · ${usd(lote.ha)} ha`}
        acciones={<BotonImprimir />}
      />

      <div className="grid gap-4 p-4 md:grid-cols-2 md:items-start md:p-0">
        <div className="flex flex-col gap-4">
          <form className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-bold">Datos de cosecha</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={campo}>
                Rinde kg/ha *
                <input className={entrada} defaultValue={num(cosecha.rindeKgHa, 0)} inputMode="decimal" required />
              </label>
              <label className={campo}>
                Pizarra USD/tn *
                <input className={entrada} defaultValue={num(cosecha.precioPizarra)} inputMode="decimal" required />
              </label>
              <label className={campo}>
                Arrendamiento %
                <input className={entrada} defaultValue={num((cosecha.arrendamientoPorcentaje ?? 0) * 100)} inputMode="decimal" />
              </label>
              <label className={campo}>
                Comercialización %
                <input className={entrada} defaultValue={num(cosecha.gastosComercializacionPorcentaje * 100)} inputMode="decimal" />
              </label>
              <label className={campo}>
                Flete USD/tn
                <input className={entrada} defaultValue={num(cosecha.fleteUsdTn)} inputMode="decimal" />
              </label>
              <label className={campo}>
                Bonificación %
                <input className={entrada} placeholder="0" inputMode="decimal" />
              </label>
            </div>
            <p className="text-muted-foreground text-xs">
              {num(r.tnBrutas, 1)} tn cosechadas · {num(r.tnArrendamiento, 1)} tn de arrendamiento ·{" "}
              {num(r.tnNetas, 1)} tn netas
            </p>
            <button type="button" className="bg-primary text-primary-foreground h-11 rounded-lg font-bold">
              Guardar datos de cosecha
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <section className="bg-primary text-primary-foreground relative grid grid-cols-3 gap-2 overflow-hidden rounded-2xl p-5">
            <div className="bg-sol absolute inset-x-0 top-0 h-1" aria-hidden />
            <p className="col-span-3 text-sm opacity-80">Margen bruto</p>
            <div>
              <p className="text-2xl font-black tabular-nums">{usd(r.margen)}</p>
              <p className="text-xs opacity-80">USD total</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums">{usd(r.margen / lote.ha)}</p>
              <p className="text-xs opacity-80">USD/ha</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums">{usd2(r.tnHa(r.margen))}</p>
              <p className="text-xs opacity-80">tn/ha</p>
            </div>
          </section>

          <section className="bg-card overflow-hidden rounded-xl border text-sm">
            <div className="text-muted-foreground grid grid-cols-[1fr_80px_60px_50px] gap-2 border-b px-4 py-2.5 text-xs font-bold">
              <span>Concepto</span>
              <span className="text-right">USD</span>
              <span className="text-right">USD/ha</span>
              <span className="text-right">tn/ha</span>
            </div>
            {filas.map((f) => (
              <div
                key={f.texto}
                className={`grid grid-cols-[1fr_80px_60px_50px] gap-2 px-4 py-2 tabular-nums ${f.fuerte ? "font-bold" : "text-muted-foreground"} ${f.separador ? "border-y" : ""}`}
              >
                <span>{f.texto}</span>
                <span className="text-right">{usd(f.valor)}</span>
                <span className="text-right">{usd(f.valor / lote.ha)}</span>
                <span className="text-right">{usd2(r.tnHa(f.valor))}</span>
              </div>
            ))}
            <div className="text-positivo grid grid-cols-[1fr_80px_60px_50px] gap-2 border-t px-4 py-2.5 font-black tabular-nums">
              <span>Margen bruto</span>
              <span className="text-right">{usd(r.margen)}</span>
              <span className="text-right">{usd(r.margen / lote.ha)}</span>
              <span className="text-right">{usd2(r.tnHa(r.margen))}</span>
            </div>
          </section>

          <section className="bg-card flex flex-col gap-2.5 rounded-xl border p-4 text-sm">
            <h2 className="font-bold">En toneladas de grano por ha</h2>
            {[...barras, { texto: "Margen", valor: r.margen }].map((b) => (
              <div key={b.texto} className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
                <span className={b.texto === "Margen" ? "font-bold" : ""}>{b.texto}</span>
                <span className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <span
                    className={`block h-full rounded-full ${b.texto === "Margen" ? "bg-positivo" : "bg-zafiro"}`}
                    style={{ width: `${(Math.max(r.tnHa(b.valor), 0) / maxTn) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{usd2(r.tnHa(b.valor))}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
