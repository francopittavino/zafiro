import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { listarOrdenes } from "@/lib/ordenes";
import { fechaCorta } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { ESTADOS_ORDEN } from "./estados";

export default async function Ordenes() {
  const [datos, ordenes] = await Promise.all([obtenerDatos(), listarOrdenes()]);

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Órdenes de trabajo"
        subtitulo="Lo que se va a hacer, para mandarle al productor"
        acciones={
          <Link href="/ordenes/nueva" className="bg-primary text-primary-foreground flex h-10 items-center rounded-lg px-3 text-sm font-bold">
            + Orden
          </Link>
        }
      />
      <div className="p-4 md:max-w-3xl md:p-0">
        {ordenes.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
            Todavía no hay órdenes. Una orden junta la labor, el lote, los productos, la receta y los costos estimados, y
            se descarga en PDF para mandarle al productor antes de hacer el trabajo.
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border">
            {ordenes.map((o) => {
              const lote = datos.lotes.find((l) => l.id === o.loteId);
              const campo = datos.campos.find((c) => c.id === lote?.campoId);
              const tipo = datos.tiposLabor.find((t) => t.id === o.tipoLaborId)?.nombre;
              return (
                <li key={o.id}>
                  <Link href={`/ordenes/${o.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3">
                    <span className="text-zafiro w-12 shrink-0 text-sm font-black tabular-nums">N° {o.numero}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {campo?.nombre} · {lote?.codigo} {lote?.nombre}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {fechaCorta(o.fechaPrevista ?? o.fecha)}
                        {tipo && ` · ${tipo}`}
                        {o.contratista && ` · ${o.contratista}`}
                      </span>
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", ESTADOS_ORDEN[o.estado].clase)}>
                      {ESTADOS_ORDEN[o.estado].texto}
                    </span>
                    <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
