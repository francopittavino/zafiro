import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { BotonEditarLote } from "@/components/app/altas";
import { GaleriaFotos } from "@/components/app/galeria-fotos";
import { fotosDe } from "@/lib/fotos";
import { obtenerDatos } from "@/lib/datos";
import { costosDelCiclo, laboresDetalladas, margenDelLote } from "@/lib/consultas";
import { fechaCorta, usd } from "@/lib/formato";

export default async function FichaLote({ params }: PageProps<"/lotes/[id]">) {
  const { id } = await params;
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === Number(id));
  if (!lote) notFound();

  const campo = datos.campos.find((c) => c.id === lote.campoId);
  const labores = await laboresDetalladas({ loteId: lote.id });
  const costos = costosDelCiclo(labores);
  const margen = await margenDelLote(lote.id);
  const galeria = await fotosDe({ tipo: "lote", id: lote.id });
  const partes = [
    { texto: "Insumos", valor: costos.insumos, clase: "bg-primary" },
    { texto: "Labores", valor: costos.labores, clase: "bg-zafiro" },
    { texto: "Cosecha", valor: costos.cosecha, clase: "bg-chart-3" },
  ];

  return (
    <>
      <Encabezado
        volver="/lotes"
        titulo={`${lote.codigo} · ${lote.nombre}`}
        subtitulo={`${campo?.nombre} · ${usd(lote.ha)} ha`}
        acciones={<BotonEditarLote campos={datos.campos} lote={lote} />}
      />

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.4fr] md:items-start md:p-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-bold">
              Campaña {datos.campania}
            </span>
            <ChipCultivo cultivo={lote.cultivo} />
          </div>

          <section className="bg-card grid grid-cols-2 gap-4 rounded-xl border p-4">
            <div>
              <p className="text-muted-foreground text-xs">Costo total</p>
              <p className="text-xl font-black tabular-nums">USD {usd(costos.total)}</p>
              <p className="text-muted-foreground text-xs">{usd(costos.total / lote.ha)} USD/ha</p>
            </div>
            {margen ? (
              <Link href={`/lotes/${lote.id}/margen`} className="hover:bg-muted/60 -m-2 rounded-lg p-2">
                <p className="text-muted-foreground text-xs">Margen bruto</p>
                <p className="text-positivo text-xl font-black tabular-nums">USD {usd(margen.resultado.margen)}</p>
                <p className="text-zafiro text-xs font-bold">Ver detalle →</p>
              </Link>
            ) : (
              <div>
                <p className="text-muted-foreground text-xs">Margen bruto</p>
                <p className="text-muted-foreground text-sm">Falta cargar la cosecha</p>
              </div>
            )}
            {costos.total > 0 && (
              <>
                <div className="col-span-2 flex h-2 overflow-hidden rounded-full">
                  {partes.map((p) => (
                    <span key={p.texto} className={p.clase} style={{ width: `${(p.valor / costos.total) * 100}%` }} />
                  ))}
                </div>
                <ul className="text-muted-foreground col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {partes.map((p) => (
                    <li key={p.texto} className="flex items-center gap-1.5">
                      <span className={`${p.clase} size-2 rounded-full`} aria-hidden />
                      {p.texto} {usd(p.valor)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Link
            href={`/registrar?lote=${lote.id}`}
            className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold"
          >
            <Plus className="size-5" aria-hidden />
            Registrar labor en este lote
          </Link>

          <GaleriaFotos destino={{ tipo: "lote", id: lote.id }} {...galeria} />
        </div>

        <section>
          <h2 className="mb-2 font-bold">Labores del ciclo</h2>
          {labores.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
              Todavía no hay labores en este lote.
            </p>
          ) : (
            <ol className="bg-card divide-y rounded-xl border">
              {labores.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/registrar?labor=${l.id}`}
                    className="hover:bg-muted/60 grid grid-cols-[52px_1fr_auto] gap-2 px-4 py-3"
                  >
                  <span className="text-muted-foreground pt-0.5 text-xs">{fechaCorta(l.fecha)}</span>
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {l.tipo}
                      {l.ha !== lote.ha && <span className="text-muted-foreground font-normal"> · {usd(l.ha)} ha</span>}
                    </span>
                    {l.productos.length > 0 && (
                      <span className="text-muted-foreground block text-sm">
                        {l.productos.map((p) => p.nombre).join(", ")}
                      </span>
                    )}
                  </span>
                    <span className="font-bold tabular-nums">{usd(l.costo.total)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
