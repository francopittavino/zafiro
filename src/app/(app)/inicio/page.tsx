import Link from "next/link";
import { Plus } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas, resumenPorCampo } from "@/lib/consultas";
import { fechaCorta, usd } from "@/lib/formato";

export default async function Inicio() {
  const datos = await obtenerDatos();
  const labores = await laboresDetalladas();
  const campos = (await resumenPorCampo()).filter((c) => c.total > 0);

  const insumos = labores.reduce((t, l) => t + l.costo.insumos, 0);
  const trabajos = labores.reduce((t, l) => t + l.costo.trabajo, 0);
  const total = insumos + trabajos;
  const haTrabajadas = campos.reduce((t, c) => t + c.ha, 0);
  const haTotales = datos.lotes.reduce((t, l) => t + l.ha, 0);
  const maxUsdHa = Math.max(...campos.map((c) => c.usdHa), 1);

  return (
    <>
      <Encabezado
        marca
        titulo="Inicio"
        subtitulo={`Campaña ${datos.campania}`}
      />

      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-0">
        <section className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl p-5 md:col-span-2">
          <div className="bg-sol absolute inset-x-0 top-0 h-1" aria-hidden />
          <p className="text-sm opacity-80">Costo total de la campaña</p>
          <p className="mt-1 text-3xl font-black tabular-nums md:text-4xl">USD {usd(total)}</p>
          <p className="mt-1 text-sm opacity-80">
            {usd(haTrabajadas ? total / haTrabajadas : 0)} USD/ha · {usd(haTrabajadas)} ha trabajadas de{" "}
            {usd(haTotales)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div>
              <p className="text-xs opacity-80">Insumos</p>
              <p className="text-lg font-bold tabular-nums">USD {usd(insumos)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Labores</p>
              <p className="text-lg font-bold tabular-nums">USD {usd(trabajos)}</p>
            </div>
          </div>
        </section>

        <Link
          href="/registrar"
          className="bg-card hover:bg-muted flex items-center justify-center gap-3 rounded-2xl border p-5 font-bold md:flex-col md:text-lg"
        >
          <span className="bg-primary text-primary-foreground rounded-full p-2.5">
            <Plus className="size-6" aria-hidden />
          </span>
          Registrar labor
        </Link>

        <section className="md:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">Últimas labores</h2>
            <Link href="/historial" className="text-zafiro text-sm font-bold">
              Ver todas
            </Link>
          </div>
          <ul className="bg-card divide-y rounded-xl border">
            {labores.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lotes/${l.loteId}`}
                  className="hover:bg-muted/60 flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{l.tipo}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {l.lote.codigo} {l.lote.nombre} · {usd(l.ha)} ha
                      {l.productos.length > 0 && ` · ${l.productos.length} productos`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums">USD {usd(l.costo.total)}</span>
                    <span className="text-muted-foreground block text-xs">{fechaCorta(l.fecha)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Costo por campo (USD/ha)</h2>
          <ul className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            {campos.map((c) => (
              <li key={c.id} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-sm">
                <span className="truncate">{c.nombre}</span>
                <span className="bg-muted h-2 overflow-hidden rounded-full">
                  <span
                    className="bg-zafiro block h-full rounded-full"
                    style={{ width: `${(c.usdHa / maxUsdHa) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{usd(c.usdHa)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
