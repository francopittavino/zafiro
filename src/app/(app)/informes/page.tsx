import Link from "next/link";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas, resumenPorCampo } from "@/lib/consultas";
import { NOMBRE_CATEGORIA, num, usd } from "@/lib/formato";

export default async function Informes() {
  const datos = await obtenerDatos();
  const campos = (await resumenPorCampo()).filter((c) => c.total > 0);
  const labores = await laboresDetalladas();

  // Consumo de insumos de la campaña (cantidades totales y costo), útil para compras.
  const consumo = new Map<string, { unidad: string; categoria: string; cantidad: number; costo: number }>();
  for (const l of labores) {
    for (const p of l.productos) {
      const producto = datos.productos.find((x) => x.nombre === p.nombre)!;
      const fila = consumo.get(p.nombre) ?? { unidad: p.unidad, categoria: producto.categoria, cantidad: 0, costo: 0 };
      fila.cantidad += p.dosis * l.ha;
      fila.costo += p.dosis * p.precio * l.ha;
      consumo.set(p.nombre, fila);
    }
  }
  const insumos = [...consumo.entries()].sort((a, b) => b[1].costo - a[1].costo);

  return (
    <>
      <Encabezado volver="/mas" titulo="Informes" subtitulo={`Campaña ${datos.campania}`} />

      <div className="grid gap-4 p-4 md:grid-cols-2 md:items-start md:p-0">
        <section>
          <h2 className="mb-2 font-bold">Margen bruto por lote</h2>
          <ul className="bg-card divide-y rounded-xl border">
            {datos.cosechas.map((c) => {
              const lote = datos.lotes.find((l) => l.id === c.loteId)!;
              return (
                <li key={c.loteId}>
                  <Link href={`/lotes/${lote.id}/margen`} className="hover:bg-muted/60 flex justify-between px-4 py-3">
                    <span>
                      <span className="block font-bold">
                        {lote.codigo} {lote.nombre}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {lote.cultivo} · {num(c.rindeKgHa, 0)} kg/ha
                      </span>
                    </span>
                    <span className="text-zafiro self-center text-sm font-bold">Ver →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Aparecen los lotes con cosecha cargada ({datos.cosechas.length} de {datos.lotes.length}).
          </p>

          <h2 className="mt-6 mb-2 font-bold">Costos por campo</h2>
          <div className="bg-card overflow-hidden rounded-xl border text-sm">
            <div className="text-muted-foreground grid grid-cols-[1fr_60px_80px_60px] gap-2 border-b px-4 py-2.5 text-xs font-bold">
              <span>Campo</span>
              <span className="text-right">ha</span>
              <span className="text-right">USD</span>
              <span className="text-right">USD/ha</span>
            </div>
            {campos.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_60px_80px_60px] gap-2 border-b px-4 py-2.5 tabular-nums last:border-0">
                <span className="truncate">{c.nombre}</span>
                <span className="text-right">{usd(c.ha)}</span>
                <span className="text-right">{usd(c.total)}</span>
                <span className="text-right font-bold">{usd(c.usdHa)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Consumo de insumos</h2>
          <div className="bg-card overflow-hidden rounded-xl border text-sm">
            <div className="text-muted-foreground grid grid-cols-[1fr_90px_80px] gap-2 border-b px-4 py-2.5 text-xs font-bold">
              <span>Producto</span>
              <span className="text-right">Cantidad</span>
              <span className="text-right">USD</span>
            </div>
            {insumos.map(([nombre, f]) => (
              <div key={nombre} className="grid grid-cols-[1fr_90px_80px] gap-2 border-b px-4 py-2.5 tabular-nums last:border-0">
                <span className="min-w-0">
                  <span className="block truncate">{nombre}</span>
                  <span className="text-muted-foreground block text-xs">{NOMBRE_CATEGORIA[f.categoria]}</span>
                </span>
                <span className="text-right">
                  {num(f.cantidad, 1)} {f.unidad}
                </span>
                <span className="text-right font-bold">{usd(f.costo)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
