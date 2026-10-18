import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { BotonProductor } from "@/components/app/altas";
import { obtenerDatos } from "@/lib/datos";
import { costosPorLote } from "@/lib/consultas";
import { usd } from "@/lib/formato";

export default async function Productores() {
  const datos = await obtenerDatos();
  const filas = await costosPorLote();
  const productores = datos.productores ?? [];
  const sinProductor = datos.campos.filter((c) => !c.productorId);

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Productores"
        subtitulo="A quiénes asesorás: cada uno recibe sus informes y recetas en PDF"
        acciones={<BotonProductor />}
      />
      <div className="flex flex-col gap-4 p-4 md:max-w-3xl md:p-0">
        {productores.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
            Todavía no hay productores. Creá uno y después asignale sus campos (desde la ficha de cada campo).
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border">
            {productores.map((p) => {
              const campos = datos.campos.filter((c) => c.productorId === p.id);
              const lotes = filas.filter((f) => f.productorId === p.id);
              const ha = lotes.reduce((t, f) => t + f.lote.ha, 0);
              const total = lotes.reduce((t, f) => t + f.costos.total, 0);
              return (
                <li key={p.id}>
                  <Link href={`/productores/${p.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{p.nombre}</span>
                      <span className="text-muted-foreground block text-xs">
                        {campos.length} {campos.length === 1 ? "campo" : "campos"} · {usd(ha)} ha
                        {p.localidad && ` · ${p.localidad}`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold tabular-nums">USD {usd(total)}</span>
                      <span className="text-muted-foreground block text-xs">en la campaña</span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {sinProductor.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Campos sin productor asignado:{" "}
            {sinProductor.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/campos/${c.id}`} className="text-zafiro font-bold">
                  {c.nombre}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
      </div>
    </>
  );
}
