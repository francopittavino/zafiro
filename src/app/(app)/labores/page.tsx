import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { tarifaUsdHa } from "@/lib/calculos";
import { num, usd2 } from "@/lib/formato";
import { BotonCotizacion, BotonNuevaLabor } from "@/components/app/altas";

export default async function Labores() {
  const { tiposLabor, cotizacion } = await obtenerDatos();

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Labores y tarifas"
        subtitulo="El costo en USD/ha sale del gasoil y el tipo de cambio"
        acciones={<BotonNuevaLabor />}
      />

      <div className="flex flex-col gap-4 p-4 md:p-0">
        <section className="bg-card grid grid-cols-2 gap-3 rounded-xl border p-4 md:max-w-md">
          <div>
            <p className="text-muted-foreground text-xs">Gasoil</p>
            <p className="text-lg font-black tabular-nums">$ {num(cotizacion.precioGasoil)} /L</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tipo de cambio</p>
            <p className="text-lg font-black tabular-nums">$ {num(cotizacion.tipoCambio)}</p>
          </div>
          <div className="col-span-2 grid">
            <BotonCotizacion actual={cotizacion} />
          </div>
        </section>

        <ul className="bg-card divide-y rounded-xl border md:max-w-3xl">
          {tiposLabor.map((t) => {
            const tarifa = tarifaUsdHa(t, cotizacion);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-bold">{t.nombre}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t.cotizacion === "usd_fijo"
                      ? "Costo fijo"
                      : t.litrosGasoilHa
                        ? `${num(t.litrosGasoilHa)} L de gasoil/ha`
                        : "Sin tarifa cargada"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold tabular-nums">{tarifa ? usd2(tarifa) : "—"}</span>
                  <span className="text-muted-foreground block text-xs">USD/ha</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
