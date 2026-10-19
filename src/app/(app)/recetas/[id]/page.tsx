import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileDown } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { valoresExtra } from "@/components/app/campos-extra";
import { recetaDetallada } from "@/lib/recetas";
import { fechaCorta, num } from "@/lib/formato";
import { BotonEliminarReceta } from "./eliminar";
import { RecetaOficial } from "./oficial";

export default async function VerReceta({ params }: PageProps<"/recetas/[id]">) {
  const { id } = await params;
  const detalle = await recetaDetallada(Number(id));
  if (!detalle) notFound();
  const { receta: r, lote, campo, productor, ha, productos, personalizados } = detalle;

  const datos = [
    { nombre: "Productor", valor: productor?.nombre },
    { nombre: "Campo", valor: campo?.nombre },
    { nombre: "Lote", valor: lote && `${lote.codigo} ${lote.nombre}` },
    { nombre: "Cultivo", valor: lote?.cultivo },
    { nombre: "Superficie", valor: `${num(ha)} ha` },
    { nombre: "Objetivo", valor: r.plagaObjetivo },
    { nombre: "Aplicación", valor: r.tipoAplicacion },
    { nombre: "Caudal", valor: r.caudalLHa != null ? `${num(r.caudalLHa)} L/ha` : null },
    { nombre: "Aplicar desde", valor: r.fechaAplicacionPrevista && fechaCorta(r.fechaAplicacionPrevista) },
    { nombre: "N° receta oficial", valor: r.numeroOficial },
    ...valoresExtra(personalizados, r.extras),
  ].filter((d) => d.valor);

  return (
    <>
      <Encabezado
        volver="/recetas"
        titulo={`Receta N° ${r.numero}`}
        subtitulo={`${fechaCorta(r.fecha)} · ${r.estado}`}
        acciones={
          <Link
            href={`/recetas/nueva?receta=${r.id}`}
            className="bg-card hover:bg-muted flex h-10 items-center rounded-lg border px-3 text-sm font-bold"
          >
            Editar
          </Link>
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr] md:items-start md:p-0">
        <div className="flex flex-col gap-4">
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
          <RecetaOficial recetaId={r.id} cargada={Boolean(r.archivoOficial)} />
          <a
            href={`/recetas/${r.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold"
          >
            <FileDown className="size-5" aria-hidden />
            {r.archivoOficial ? "Descargar PDF (resumen + oficial)" : "Descargar PDF"}
          </a>
          {r.estado !== "anulada" && (
            <Link
              href={`/ordenes/nueva?receta=${r.id}`}
              className="bg-card hover:bg-muted flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold"
            >
              <ClipboardList className="text-zafiro size-5" aria-hidden />
              Armar la orden de trabajo con esta receta
            </Link>
          )}
          <BotonEliminarReceta id={r.id} />
        </div>

        <div className="flex flex-col gap-4">
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
                        {[
                          p.principioActivo,
                          p.bandaToxicologica && `Banda ${p.bandaToxicologica}`,
                          p.carenciaDias != null && `Carencia ${p.carenciaDias} días`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block font-bold">
                        {num(p.dosis, 3)} {p.unidad}/ha
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {num(p.total)} {p.unidad} en total
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {[
            ["Recomendaciones", r.recomendaciones],
            ["Condiciones y distancias", r.condiciones],
            ["Observaciones", r.observaciones],
          ].map(
            ([titulo, texto]) =>
              texto && (
                <section key={titulo} className="bg-card rounded-xl border p-4 text-sm">
                  <h2 className="mb-1 font-bold">{titulo}</h2>
                  <p className="whitespace-pre-line">{texto}</p>
                </section>
              ),
          )}
        </div>
      </div>
    </>
  );
}
