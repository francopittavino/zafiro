import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos, type Gasto } from "@/lib/datos";
import { usd } from "@/lib/formato";
import { BotonNuevoGasto, FilaGasto } from "./formulario-gasto";

export default async function Gastos() {
  const datos = await obtenerDatos();
  const gastos = datos.gastos ?? [];
  const opciones = { campos: datos.campos, lotes: datos.lotes, categorias: datos.categoriasGasto ?? [] };
  const total = gastos.reduce((t, g) => t + g.importe, 0);

  const destino = (g: Gasto) => {
    if (g.loteId) {
      const lote = datos.lotes.find((l) => l.id === g.loteId);
      const campo = datos.campos.find((c) => c.id === lote?.campoId);
      return `${campo?.nombre ?? ""} · ${lote?.codigo ?? ""} ${lote?.nombre ?? ""}`;
    }
    if (g.campoId) return `Campo ${datos.campos.find((c) => c.id === g.campoId)?.nombre ?? ""} (todos los lotes)`;
    return "General de la campaña";
  };

  const porCategoria = new Map<string, number>();
  for (const g of gastos) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.importe);

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Otros gastos"
        subtitulo={`Campaña ${datos.campania} · USD ${usd(total)}`}
        acciones={<BotonNuevoGasto {...opciones} />}
      />
      <div className="grid gap-4 p-4 md:grid-cols-[1.6fr_1fr] md:items-start md:p-0">
        <section>
          {gastos.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
              Acá van los gastos que no son labores ni insumos: alquiler, flete, seguros, honorarios… Se suman al costo del
              lote (o se reparten entre los lotes del campo) y al margen bruto.
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {gastos.map((g) => (
                <FilaGasto key={g.id} gasto={g} destino={destino(g)} {...opciones} />
              ))}
            </ul>
          )}
        </section>
        {porCategoria.size > 0 && (
          <section className="bg-card rounded-xl border p-4">
            <h2 className="mb-2 font-bold">Por categoría</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {[...porCategoria.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([categoria, importe]) => (
                  <li key={categoria} className="flex justify-between tabular-nums">
                    <span>{categoria}</span>
                    <span className="font-bold">{usd(importe)}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
