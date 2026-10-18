import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Mail, Phone } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { BotonProductor } from "@/components/app/altas";
import { obtenerDatos } from "@/lib/datos";
import { costosPorLote } from "@/lib/consultas";
import { usd } from "@/lib/formato";

export default async function FichaProductor({ params }: PageProps<"/productores/[id]">) {
  const { id } = await params;
  const datos = await obtenerDatos();
  const productor = datos.productores?.find((p) => p.id === Number(id));
  if (!productor) notFound();

  const campos = datos.campos.filter((c) => c.productorId === productor.id);
  const filas = (await costosPorLote()).filter((f) => f.productorId === productor.id);
  const ha = filas.reduce((t, f) => t + f.lote.ha, 0);
  const total = filas.reduce((t, f) => t + f.costos.total, 0);

  return (
    <>
      <Encabezado
        volver="/productores"
        titulo={productor.nombre}
        subtitulo={`${campos.length} ${campos.length === 1 ? "campo" : "campos"} · ${usd(ha)} ha · USD ${usd(total)} en la campaña ${datos.campania}`}
        acciones={<BotonProductor productor={productor} />}
      />
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.4fr] md:items-start md:p-0">
        <div className="flex flex-col gap-4">
          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm">
            {productor.telefono && (
              <a href={`tel:${productor.telefono}`} className="flex items-center gap-2">
                <Phone className="text-muted-foreground size-4" aria-hidden /> {productor.telefono}
              </a>
            )}
            {productor.email && (
              <a href={`mailto:${productor.email}`} className="flex items-center gap-2">
                <Mail className="text-muted-foreground size-4" aria-hidden /> {productor.email}
              </a>
            )}
            {productor.cuit && <p>CUIT {productor.cuit}</p>}
            {productor.localidad && <p>{productor.localidad}</p>}
            {productor.notas && <p className="text-muted-foreground whitespace-pre-line">{productor.notas}</p>}
            {!productor.telefono && !productor.email && !productor.cuit && !productor.localidad && (
              <p className="text-muted-foreground">Sin datos de contacto.</p>
            )}
          </section>

          <Link
            href={`/informes/pdf?productor=${productor.id}`}
            className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold"
          >
            <FileDown className="size-5" aria-hidden />
            Informe de la campaña en PDF
          </Link>
        </div>

        <section>
          <h2 className="mb-2 font-bold">Campos</h2>
          {campos.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
              Este productor todavía no tiene campos. Asignáselos desde la ficha de cada campo (botón Editar).
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {campos.map((c) => {
                const delCampo = filas.filter((f) => f.campoId === c.id);
                const haCampo = delCampo.reduce((t, f) => t + f.lote.ha, 0);
                const totalCampo = delCampo.reduce((t, f) => t + f.costos.total, 0);
                return (
                  <li key={c.id}>
                    <Link href={`/campos/${c.id}`} className="hover:bg-muted/60 flex justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="block font-bold">{c.nombre}</span>
                        <span className="text-muted-foreground block text-xs">
                          {delCampo.length} lotes · {usd(haCampo)} ha{c.localidad && ` · ${c.localidad}`}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-bold tabular-nums">USD {usd(totalCampo)}</span>
                        <span className="text-muted-foreground block text-xs">
                          {haCampo ? usd(totalCampo / haCampo) : 0} USD/ha
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
