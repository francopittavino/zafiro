import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FileDown } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { ordenDetallada } from "@/lib/ordenes";
import { fechaCorta, num, usd2 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { ESTADOS_ORDEN } from "../estados";
import { BotonEliminarOrden, BotonEnviada } from "./acciones-orden";

export default async function VerOrden({ params }: PageProps<"/ordenes/[id]">) {
  const { id } = await params;
  const detalle = await ordenDetallada(Number(id));
  if (!detalle) notFound();
  const { orden: o, lote, campo, productor, receta, tipoLabor, costos, productos } = detalle;
  const estado = ESTADOS_ORDEN[o.estado];

  const datos = [
    { nombre: "Productor", valor: productor?.nombre },
    { nombre: "Campo", valor: campo?.nombre },
    { nombre: "Lote", valor: lote && `${lote.codigo} ${lote.nombre}` },
    { nombre: "Cultivo", valor: lote?.cultivo },
    { nombre: "Labor", valor: tipoLabor },
    { nombre: "Superficie", valor: `${num(o.ha)} ha` },
    { nombre: "Hacer el", valor: o.fechaPrevista && fechaCorta(o.fechaPrevista) },
    {
      nombre: "La hace",
      valor:
        o.modalidad === "contratista"
          ? `Contratista${o.contratista ? `: ${o.contratista}` : ""}`
          : o.modalidad === "propia"
            ? "Máquina propia"
            : null,
    },
    {
      nombre: "Se cobra",
      valor:
        o.cobro === "hora"
          ? o.horas != null && `${num(o.horas)} h × ${usd2(o.costoHora ?? 0)} USD/h`
          : o.costoLaborHa != null && `${usd2(o.costoLaborHa)} USD/ha`,
    },
  ].filter((d) => d.valor);

  return (
    <>
      <Encabezado
        volver="/ordenes"
        titulo={`Orden de trabajo N° ${o.numero}`}
        subtitulo={fechaCorta(o.fecha)}
        acciones={
          <Link
            href={`/ordenes/nueva?orden=${o.id}`}
            className="bg-card hover:bg-muted flex h-10 items-center rounded-lg border px-3 text-sm font-bold"
          >
            Editar
          </Link>
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr] md:items-start md:p-0">
        <div className="flex flex-col gap-4">
          <span className={cn("w-fit rounded-full px-3 py-1 text-sm font-bold", estado.clase)}>{estado.texto}</span>
          <section className="bg-card rounded-xl border p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {datos.map((d) => (
                <div key={d.nombre}>
                  <dt className="text-muted-foreground text-xs">{d.nombre}</dt>
                  <dd className="font-bold">{d.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
          <a
            href={`/ordenes/${o.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold"
          >
            <FileDown className="size-5" aria-hidden />
            {receta?.receta.archivoOficial ? "Descargar PDF (con la receta oficial)" : "Descargar PDF"}
          </a>
          {o.estado === "pendiente" && <BotonEnviada id={o.id} />}
          {o.laborId ? (
            <Link
              href={`/historial/${o.laborId}/pdf`}
              target="_blank"
              className="bg-card hover:bg-muted flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold"
            >
              <ClipboardCheck className="text-positivo size-5" aria-hidden />
              Ya se registró la labor: ver su PDF
            </Link>
          ) : (
            o.estado !== "anulada" && (
              <Link
                href={`/registrar?orden=${o.id}`}
                className="bg-card hover:bg-muted flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold"
              >
                <ClipboardCheck className="text-zafiro size-5" aria-hidden />
                Ya se hizo: registrar la labor
              </Link>
            )
          )}
          <BotonEliminarOrden id={o.id} />
        </div>

        <div className="flex flex-col gap-4">
          {o.instrucciones && (
            <section className="bg-card rounded-xl border p-4 text-sm">
              <h2 className="mb-1 font-bold">Instrucciones</h2>
              <p className="whitespace-pre-line">{o.instrucciones}</p>
            </section>
          )}
          <section>
            <h2 className="mb-2 font-bold">Productos</h2>
            {productos.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">Sin productos.</p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border text-sm">
                {productos.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block font-bold">{p.nombre}</span>
                      <span className="text-muted-foreground block text-xs">
                        {num(p.dosis, 3)} {p.unidad}/ha · {num(p.total)} {p.unidad} en total
                      </span>
                    </span>
                    <span className="text-right font-bold tabular-nums">USD {usd2(p.importe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {receta && (
            <Link href={`/recetas/${receta.receta.id}`} className="bg-card hover:bg-muted/60 rounded-xl border p-4 text-sm">
              <span className="block font-bold">Receta N° {receta.receta.numero}</span>
              <span className="text-muted-foreground block text-xs">
                {[receta.receta.plagaObjetivo, receta.receta.archivoOficial && "con la receta oficial en PDF"]
                  .filter(Boolean)
                  .join(" · ") || "Sale completa en el PDF de la orden"}
              </span>
            </Link>
          )}
          <section className="bg-card rounded-xl border p-4 text-sm">
            <h2 className="mb-2 font-bold">Costo estimado</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
              <dt className="text-muted-foreground">Insumos</dt>
              <dd className="text-right">{usd2(costos.insumos)}</dd>
              <dt className="text-muted-foreground">Labor</dt>
              <dd className="text-right">{usd2(costos.trabajo)}</dd>
              {o.gastos.map((g, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">{g.concepto}</dt>
                  <dd className="text-right">{usd2(g.importe)}</dd>
                </div>
              ))}
              <dt className="font-bold">Total USD</dt>
              <dd className="text-right text-lg font-black">{usd2(costos.total)}</dd>
              <dt className="text-muted-foreground">Por hectárea</dt>
              <dd className="text-right">{usd2(costos.total / o.ha)} USD/ha</dd>
            </dl>
            {!o.mostrarCostos && <p className="text-muted-foreground mt-2 text-xs">Los costos no salen en el PDF.</p>}
          </section>
          {o.observaciones && (
            <section className="bg-card rounded-xl border p-4 text-sm">
              <h2 className="mb-1 font-bold">Observaciones</h2>
              <p className="whitespace-pre-line">{o.observaciones}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
