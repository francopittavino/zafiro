import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, FileText, Plus } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { BotonEditarLote } from "@/components/app/altas";
import { GaleriaFotos } from "@/components/app/galeria-fotos";
import { valoresExtra } from "@/components/app/campos-extra";
import { fotosDe, mapasDeCampos } from "@/lib/fotos";
import { Leyenda, VistaMapa } from "@/components/app/mapa";
import { obtenerDatos } from "@/lib/datos";
import { costosDelCiclo, laboresDetalladas, margenDelLote, otrosGastosDelLote } from "@/lib/consultas";
import { fechaCorta, num, usd } from "@/lib/formato";
import { BotonNuevoGasto } from "../../gastos/formulario-gasto";
import { BotonCosecha } from "./cosecha";

export default async function FichaLote({ params }: PageProps<"/lotes/[id]">) {
  const { id } = await params;
  const datos = await obtenerDatos();
  const lote = datos.lotes.find((l) => l.id === Number(id));
  if (!lote) notFound();

  const campo = datos.campos.find((c) => c.id === lote.campoId);
  const productor = datos.productores?.find((p) => p.id === campo?.productorId);
  const labores = await laboresDetalladas({ loteId: lote.id });
  const otros = otrosGastosDelLote(datos, lote);
  const costos = costosDelCiclo(labores, otros.total);
  const margen = await margenDelLote(lote.id);
  const cosecha = datos.cosechas.find((c) => c.loteId === lote.id);
  const [galeria, mapas] = await Promise.all([fotosDe({ tipo: "lote", id: lote.id }), mapasDeCampos(campo ? [campo] : [])]);
  const mapa = campo && mapas.get(campo.id);
  const lotesDelCampo = datos.lotes.filter((l) => l.campoId === lote.campoId);
  const manchones = labores.flatMap((l) => l.zonas ?? []);
  const personalizados = datos.camposPersonalizados ?? [];
  const partes = [
    { texto: "Insumos", valor: costos.insumos, clase: "bg-primary" },
    { texto: "Labores", valor: costos.labores, clase: "bg-zafiro" },
    { texto: "Cosecha", valor: costos.cosecha, clase: "bg-chart-3" },
    { texto: "Otros gastos", valor: costos.otros, clase: "bg-sol" },
  ].filter((p) => p.valor > 0);

  const ficha = [
    { nombre: "Productor", valor: productor?.nombre },
    { nombre: "Variedad / híbrido", valor: lote.variedad },
    { nombre: "Siembra", valor: lote.fechaSiembra && fechaCorta(lote.fechaSiembra) },
    { nombre: "Tenencia", valor: lote.tenencia === "propio" ? "Propio" : lote.tenencia === "alquilado" ? "Alquilado" : null },
    { nombre: "Suelo", valor: lote.tipoSuelo },
    ...valoresExtra(personalizados.filter((c) => c.entidad === "lote"), lote.extras),
  ].filter((d) => d.valor);
  const ubicacion =
    lote.latitud != null && lote.longitud != null
      ? `https://www.google.com/maps?q=${lote.latitud},${lote.longitud}`
      : null;

  return (
    <>
      <Encabezado
        volver={campo ? `/campos/${campo.id}` : "/lotes"}
        titulo={`${lote.codigo} · ${lote.nombre}`}
        subtitulo={`${campo?.nombre} · ${usd(lote.ha)} ha`}
        acciones={<BotonEditarLote campos={datos.campos} lote={lote} personalizados={personalizados} />}
      />

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.4fr] md:items-start md:p-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-bold">
              Campaña {datos.campania}
            </span>
            <ChipCultivo cultivo={lote.cultivo} />
          </div>

          {(ficha.length > 0 || ubicacion || lote.notas) && (
            <section className="bg-card rounded-xl border p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {ficha.map((d) => (
                  <div key={d.nombre}>
                    <dt className="text-muted-foreground text-xs">{d.nombre}</dt>
                    <dd className="font-bold">{d.valor}</dd>
                  </div>
                ))}
              </dl>
              {ubicacion && (
                <a href={ubicacion} target="_blank" rel="noreferrer" className="text-zafiro mt-2 block text-sm font-bold">
                  Ver ubicación en el mapa →
                </a>
              )}
              {lote.notas && <p className="text-muted-foreground mt-2 whitespace-pre-line">{lote.notas}</p>}
            </section>
          )}

          <section className="bg-card grid grid-cols-2 gap-4 rounded-xl border p-4">
            <div>
              <p className="text-muted-foreground text-xs">Costo total</p>
              <p className="text-xl font-black tabular-nums">USD {usd(costos.total)}</p>
              <p className="text-muted-foreground text-xs">{usd(costos.total / lote.ha)} USD/ha</p>
            </div>
            {margen ? (
              <Link href={`/lotes/${lote.id}/margen`} className="hover:bg-muted/60 -m-2 rounded-lg p-2">
                <p className="text-muted-foreground text-xs">Margen bruto</p>
                <p className={`text-xl font-black tabular-nums ${margen.resultado.margen < 0 ? "text-destructive" : "text-positivo"}`}>
                  USD {usd(margen.resultado.margen)}
                </p>
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
            <div className="col-span-2 grid">
              <BotonCosecha loteId={lote.id} inicial={cosecha} />
            </div>
            {cosecha && (
              <p className="text-muted-foreground col-span-2 -mt-2 text-xs">
                Rinde {num(cosecha.rindeKgHa, 0)} kg/ha · {usd(cosecha.precioPizarra)} USD/tn
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/registrar?lote=${lote.id}`}
              className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold"
            >
              <Plus className="size-5" aria-hidden />
              Labor
            </Link>
            <Link
              href={`/recetas/nueva?lote=${lote.id}`}
              className="bg-card hover:bg-muted flex h-12 items-center justify-center gap-2 rounded-xl border font-bold"
            >
              <FileText className="size-5" aria-hidden />
              Receta
            </Link>
          </div>

          {mapa && lote.dibujo && (
            <section className="flex flex-col gap-2">
              <h2 className="font-bold">En el campo</h2>
              <VistaMapa foto={mapa} lotes={lotesDelCampo} resaltado={lote.id} zonas={manchones} />
              <Leyenda lotes={lotesDelCampo} />
              {manchones.length > 0 && (
                <p className="text-muted-foreground text-xs">En rojo punteado: manchones aplicados en las labores del lote.</p>
              )}
            </section>
          )}

          <GaleriaFotos destino={{ tipo: "lote", id: lote.id }} {...galeria} />
        </div>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className="mb-2 font-bold">Labores del ciclo</h2>
            {labores.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                Todavía no hay labores en este lote.
              </p>
            ) : (
              <ol className="bg-card divide-y rounded-xl border">
                {labores.map((l) => (
                  <li key={l.id} className="flex items-stretch">
                    <Link
                      href={`/registrar?labor=${l.id}`}
                      className="hover:bg-muted/60 grid flex-1 grid-cols-[52px_1fr_auto] gap-2 py-3 pl-4 pr-2"
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
                        {l.contratista && <span className="text-muted-foreground block text-xs">{l.contratista}</span>}
                      </span>
                      <span className="font-bold tabular-nums">{usd(l.costo.total)}</span>
                    </Link>
                    <a
                      href={`/historial/${l.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`PDF de ${l.tipo} del ${fechaCorta(l.fecha)}`}
                      title="PDF para el cliente"
                      className="text-zafiro hover:bg-muted/60 flex w-12 items-center justify-center border-l"
                    >
                      <FileDown className="size-5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Otros gastos</h2>
              <BotonNuevoGasto
                campos={datos.campos}
                lotes={datos.lotes}
                categorias={datos.categoriasGasto ?? []}
                inicial={{ loteId: lote.id }}
              />
            </div>
            {otros.gastos.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                Alquiler, flete, seguros… Los gastos del campo entero se reparten por hectárea.
              </p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border">
                {otros.gastos.map((g) => (
                  <li key={g.id} className="grid grid-cols-[52px_1fr_auto] gap-2 px-4 py-3">
                    <span className="text-muted-foreground pt-0.5 text-xs">{fechaCorta(g.fecha)}</span>
                    <span className="min-w-0">
                      <span className="block font-bold">{g.categoria}</span>
                      <span className="text-muted-foreground block text-xs">
                        {g.prorrateado ? "Parte del gasto del campo" : "Del lote"}
                        {g.descripcion && ` · ${g.descripcion}`}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums">{usd(g.importe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
