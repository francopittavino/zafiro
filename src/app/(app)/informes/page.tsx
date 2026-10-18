import Link from "next/link";
import { FileDown } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { armarInforme, consultaFiltro, leerFiltro, type Agrupacion } from "@/lib/informe";
import { ciclosCerrados, listarCampanias } from "@/lib/datos";
import { fechaCorta } from "@/lib/formato";
import { NOMBRE_CATEGORIA, num, usd } from "@/lib/formato";
import { Filtros } from "./filtros";

const AGRUPACIONES: Agrupacion[] = ["campo", "lote", "cultivo", "productor"];

export default async function Informes({ searchParams }: PageProps<"/informes">) {
  const sp = await searchParams;
  const filtro = leerFiltro(sp);
  const agrupar = AGRUPACIONES.find((a) => a === sp.agrupar) ?? "campo";
  const [informe, campanias, cerrados] = await Promise.all([armarInforme(filtro), listarCampanias(), ciclosCerrados()]);
  const { datos, totales } = informe;
  const grupos = informe.agrupar(agrupar).filter((g) => g.total > 0);
  const cultivos = [...new Set(datos.lotes.flatMap((l) => l.cultivo.split("/")).filter(Boolean))].sort();
  const pdf = `/informes/pdf?${consultaFiltro(filtro)}`;
  const partes = [
    ["Insumos", totales.insumos],
    ["Labores", totales.labores],
    ["Cosecha", totales.cosecha],
    ["Otros gastos", totales.otros],
  ] as const;

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Informes"
        subtitulo={`${informe.encabezado} · ${informe.titulo}`}
        acciones={
          <a
            href={pdf}
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold"
          >
            <FileDown className="size-4" aria-hidden />
            Exportar PDF
          </a>
        }
      />

      <div className="flex flex-col gap-4 p-4 md:p-0">
        <Filtros
          campanias={campanias}
          productores={datos.productores ?? []}
          campos={datos.campos}
          lotes={datos.lotes}
          cultivos={cultivos}
        />
        {informe.ciclo && (
          <p className="bg-zafiro-suave text-primary rounded-xl p-3 text-sm">
            Cierre del cultivo {informe.ciclo.cultivo}
            {informe.ciclo.fechaCierre && ` (cerrado el ${fechaCorta(informe.ciclo.fechaCierre)})`}.{" "}
            <Link href="/informes" className="font-bold underline">
              Volver a los cultivos en curso
            </Link>
          </p>
        )}

        <section className="bg-card grid grid-cols-2 gap-4 rounded-xl border p-4 md:grid-cols-6">
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs">Costo total</p>
            <p className="text-2xl font-black tabular-nums">USD {usd(totales.total)}</p>
            <p className="text-muted-foreground text-xs">
              {totales.ha ? `${usd(totales.total / totales.ha)} USD/ha · ${usd(totales.ha)} ha con costos` : "Sin costos cargados"}
            </p>
          </div>
          {partes.map(([texto, valor]) => (
            <div key={texto}>
              <p className="text-muted-foreground text-xs">{texto}</p>
              <p className="font-bold tabular-nums">USD {usd(valor)}</p>
              <p className="text-muted-foreground text-xs">{totales.ha ? usd(valor / totales.ha) : 0} USD/ha</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section>
            <h2 className="mb-2 font-bold">Costos por {agrupar}</h2>
            {grupos.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">No hay costos con estos filtros.</p>
            ) : (
              <div className="bg-card overflow-hidden rounded-xl border text-sm">
                <div className="text-muted-foreground grid grid-cols-[1fr_56px_80px_60px] gap-2 border-b px-4 py-2.5 text-xs font-bold">
                  <span className="capitalize">{agrupar}</span>
                  <span className="text-right">ha</span>
                  <span className="text-right">USD</span>
                  <span className="text-right">USD/ha</span>
                </div>
                {grupos.map((g) => (
                  <div key={g.nombre} className="grid grid-cols-[1fr_56px_80px_60px] gap-2 border-b px-4 py-2.5 tabular-nums last:border-0">
                    <span className="truncate">{g.nombre}</span>
                    <span className="text-right">{usd(g.ha)}</span>
                    <span className="text-right">{usd(g.total)}</span>
                    <span className="text-right font-bold">{g.ha ? usd(g.total / g.ha) : "—"}</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-6 mb-2 font-bold">Margen bruto por lote</h2>
            {informe.margenes.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                Ningún lote tiene la cosecha cargada (se carga desde la ficha del lote).
              </p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border">
                {informe.margenes.map(({ fila, cosecha, resultado }) => (
                  <li key={fila.lote.id}>
                    <Link href={`/lotes/${fila.lote.id}/margen`} className="hover:bg-muted/60 flex justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="block font-bold">
                          {fila.lote.codigo} {fila.lote.nombre}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {fila.campo} · {fila.lote.cultivo} · {num(cosecha.rindeKgHa, 0)} kg/ha
                        </span>
                      </span>
                      <span className="text-right tabular-nums">
                        <span className={`block font-bold ${resultado.margen < 0 ? "text-destructive" : "text-positivo"}`}>
                          USD {usd(resultado.margen)}
                        </span>
                        <span className="text-muted-foreground block text-xs">{usd(resultado.margen / fila.lote.ha)} USD/ha</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-bold">Cultivos cerrados</h2>
            {cerrados.length === 0 ? (
              <p className="bg-card text-muted-foreground mb-6 rounded-xl border p-4 text-sm">
                Cuando cierres un cultivo (desde la ficha del lote, después de la cosecha) aparece acá con su informe de cierre.
              </p>
            ) : (
              <ul className="bg-card mb-6 divide-y rounded-xl border text-sm">
                {cerrados.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <Link href={`/informes?ciclo=${c.id}`} className="min-w-0">
                      <span className="block font-bold">
                        {c.cultivo} · {c.lote}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {c.campo} · Campaña {c.campania}
                        {c.fechaCierre && ` · cerrado el ${fechaCorta(c.fechaCierre)}`}
                      </span>
                    </Link>
                    <a
                      href={`/informes/pdf?ciclo=${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zafiro flex shrink-0 items-center gap-1 font-bold"
                    >
                      <FileDown className="size-4" aria-hidden /> PDF
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mb-2 font-bold">Consumo de insumos</h2>
            {informe.consumo.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">Sin insumos aplicados.</p>
            ) : (
              <div className="bg-card overflow-hidden rounded-xl border text-sm">
                <div className="text-muted-foreground grid grid-cols-[1fr_90px_80px] gap-2 border-b px-4 py-2.5 text-xs font-bold">
                  <span>Producto</span>
                  <span className="text-right">Cantidad</span>
                  <span className="text-right">USD</span>
                </div>
                {informe.consumo.map((f) => (
                  <div key={f.nombre} className="grid grid-cols-[1fr_90px_80px] gap-2 border-b px-4 py-2.5 tabular-nums last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate">{f.nombre}</span>
                      <span className="text-muted-foreground block text-xs">{NOMBRE_CATEGORIA[f.categoria]}</span>
                    </span>
                    <span className="text-right">
                      {num(f.cantidad, 1)} {f.unidad}
                    </span>
                    <span className="text-right font-bold">{usd(f.costo)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
