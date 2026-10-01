import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { GaleriaFotos } from "@/components/app/galeria-fotos";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas } from "@/lib/consultas";
import { fotosDe } from "@/lib/fotos";
import { usd } from "@/lib/formato";

export default async function FichaCampo({ params }: PageProps<"/campos/[id]">) {
  const { id } = await params;
  const datos = await obtenerDatos();
  const campo = datos.campos.find((c) => c.id === Number(id));
  if (!campo) notFound();

  const lotes = datos.lotes.filter((l) => l.campoId === campo.id);
  const labores = await laboresDetalladas();
  const costoDe = (loteId: number) =>
    labores.filter((l) => l.loteId === loteId).reduce((t, l) => t + l.costo.total, 0);
  const ha = lotes.reduce((t, l) => t + l.ha, 0);
  const total = lotes.reduce((t, l) => t + costoDe(l.id), 0);
  const galeria = await fotosDe({ tipo: "campo", id: campo.id });

  return (
    <>
      <Encabezado
        volver="/lotes"
        titulo={campo.nombre}
        subtitulo={`${lotes.length} ${lotes.length === 1 ? "lote" : "lotes"} · ${usd(ha)} ha · USD ${usd(total)} en la campaña`}
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:items-start md:p-0">
        <section>
          <h2 className="mb-2 font-bold">Lotes</h2>
          <ul className="bg-card divide-y rounded-xl border">
            {lotes.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lotes/${l.id}`}
                  className="hover:bg-muted/60 grid grid-cols-[56px_1fr_auto] items-center gap-2 px-4 py-3"
                >
                  <span className="text-zafiro text-xs font-black">{l.codigo}</span>
                  <span>
                    <span className="block font-bold">{l.nombre}</span>
                    <span className="text-muted-foreground block text-xs">
                      {usd(l.ha)} ha · USD {usd(costoDe(l.id))}
                    </span>
                  </span>
                  <ChipCultivo cultivo={l.cultivo} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <GaleriaFotos destino={{ tipo: "campo", id: campo.id }} {...galeria} />
      </div>
    </>
  );
}
