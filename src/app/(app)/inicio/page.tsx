import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas } from "@/lib/consultas";
import { fechaCorta, num } from "@/lib/formato";

/**
 * Inicio simple: qué hay sembrado en cada campo, qué falta hacer y lo último cargado.
 * Los números (costos, márgenes) quedan en Informes y en la ficha de cada lote.
 */
export default async function Inicio() {
  const datos = await obtenerDatos();
  const labores = await laboresDetalladas();
  const conCultivo = datos.lotes.filter((l) => l.cicloId);
  const sinCultivo = datos.lotes.filter((l) => !l.cicloId);
  const paraCerrar = conCultivo.filter((l) => datos.cosechas.some((c) => c.loteId === l.id));
  const campos = datos.campos
    .map((c) => ({ ...c, lotes: datos.lotes.filter((l) => l.campoId === c.id) }))
    .filter((c) => c.lotes.length);

  return (
    <>
      <Encabezado marca titulo="Inicio" subtitulo={conCultivo.length ? `Campaña ${datos.campania}` : undefined} />

      <div className="flex flex-col gap-5 p-4 md:grid md:grid-cols-[1.4fr_1fr] md:items-start md:p-0">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/registrar"
              className="bg-primary text-primary-foreground flex flex-col items-center justify-center gap-2 rounded-2xl p-5 text-center font-bold"
            >
              <Plus className="size-7" aria-hidden />
              Registrar labor
            </Link>
            <Link
              href="/recetas/nueva"
              className="bg-card hover:bg-muted flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center font-bold"
            >
              <FileText className="text-zafiro size-7" aria-hidden />
              Nueva receta
            </Link>
          </div>

          {(paraCerrar.length > 0 || sinCultivo.length > 0) && (
            <section className="flex flex-col gap-2">
              <h2 className="font-bold">Para hacer</h2>
              <ul className="bg-card divide-y rounded-xl border text-sm">
                {paraCerrar.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lotes/${l.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3">
                      <span className="bg-sol size-2.5 shrink-0 rounded-full" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">
                          {l.codigo} {l.nombre}
                        </span>{" "}
                        <span className="text-muted-foreground">ya tiene la cosecha: cerrá el cultivo de {l.cultivo}</span>
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
                {sinCultivo.length > 0 && (
                  <li className="flex items-start gap-3 px-4 py-3">
                    <span className="bg-muted-foreground/40 mt-1.5 size-2.5 shrink-0 rounded-full" aria-hidden />
                    <span>
                      <span className="font-bold">
                        {sinCultivo.length} {sinCultivo.length === 1 ? "lote sin cultivo" : "lotes sin cultivo"}:
                      </span>{" "}
                      {sinCultivo.map((l, i) => (
                        <span key={l.id}>
                          {i > 0 && ", "}
                          <Link href={`/lotes/${l.id}`} className="text-zafiro font-bold">
                            {l.codigo || l.nombre}
                          </Link>
                        </span>
                      ))}
                      <span className="text-muted-foreground"> (entrá al lote para iniciarlo)</span>
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">Campos</h2>
              <Link href="/lotes" className="text-zafiro text-sm font-bold">
                Ver todos
              </Link>
            </div>
            {campos.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                Todavía no hay campos. Cargalos desde{" "}
                <Link href="/lotes" className="text-zafiro font-bold">
                  Lotes
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {campos.map((c) => (
                  <li key={c.id} className="bg-card rounded-xl border">
                    <Link href={`/campos/${c.id}`} className="hover:bg-muted/60 flex items-center justify-between px-4 pt-3 pb-2">
                      <span className="font-bold">{c.nombre}</span>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        {c.lotes.length} {c.lotes.length === 1 ? "lote" : "lotes"}
                        <ChevronRight className="size-4" aria-hidden />
                      </span>
                    </Link>
                    <ul className="flex flex-wrap gap-2 px-4 pb-3">
                      {c.lotes.map((l) => (
                        <li key={l.id}>
                          <Link
                            href={`/lotes/${l.id}`}
                            className="hover:bg-muted flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-xs font-bold"
                          >
                            {l.codigo || l.nombre}
                            {l.cultivo ? (
                              <ChipCultivo cultivo={l.cultivo} />
                            ) : (
                              <span className="text-muted-foreground px-1.5 py-0.5 font-normal">sin cultivo</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Últimas labores</h2>
            <Link href="/historial" className="text-zafiro text-sm font-bold">
              Ver todas
            </Link>
          </div>
          {labores.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">Todavía no hay labores cargadas.</p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {labores.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <Link href={`/lotes/${l.loteId}`} className="hover:bg-muted/60 flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-bold">{l.tipo}</span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {l.lote.codigo} {l.lote.nombre} · {num(l.ha, 0)} ha
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">{fechaCorta(l.fecha)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
