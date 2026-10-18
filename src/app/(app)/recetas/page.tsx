import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { listarRecetas } from "@/lib/recetas";
import { fechaCorta } from "@/lib/formato";
import { cn } from "@/lib/utils";

const ESTADOS = {
  borrador: { texto: "Borrador", clase: "bg-muted text-muted-foreground" },
  emitida: { texto: "Emitida", clase: "bg-zafiro-suave text-primary" },
  aplicada: { texto: "Aplicada", clase: "bg-positivo/10 text-positivo" },
  anulada: { texto: "Anulada", clase: "bg-destructive/10 text-destructive line-through" },
};

export default async function Recetas() {
  const [datos, recetas] = await Promise.all([obtenerDatos(), listarRecetas()]);

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Recetas"
        subtitulo="Resumen de la receta oficial para mandarle al productor"
        acciones={
          <Link href="/recetas/nueva" className="bg-primary text-primary-foreground flex h-10 items-center rounded-lg px-3 text-sm font-bold">
            + Receta
          </Link>
        }
      />
      <div className="p-4 md:max-w-3xl md:p-0">
        {recetas.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
            Todavía no hay recetas. Cada receta se numera sola y se descarga en PDF con el formato de Zafiro.
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border">
            {recetas.map((r) => {
              const lote = datos.lotes.find((l) => l.id === r.loteId);
              const campo = datos.campos.find((c) => c.id === lote?.campoId);
              const productos = r.items
                .map((i) => datos.productos.find((p) => p.id === i.productoId)?.nombre)
                .filter(Boolean)
                .join(", ");
              return (
                <li key={r.id}>
                  <Link href={`/recetas/${r.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3">
                    <span className="text-zafiro w-12 shrink-0 text-sm font-black tabular-nums">N° {r.numero}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {campo?.nombre} · {lote?.codigo} {lote?.nombre}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {fechaCorta(r.fecha)}
                        {r.plagaObjetivo && ` · ${r.plagaObjetivo}`}
                        {productos && ` · ${productos}`}
                      </span>
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", ESTADOS[r.estado].clase)}>
                      {ESTADOS[r.estado].texto}
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
