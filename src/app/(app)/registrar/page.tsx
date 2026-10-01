import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { tarifaUsdHa } from "@/lib/calculos";
import { FormularioLabor, type ValoresIniciales } from "./formulario-labor";

/**
 * /registrar              → labor nueva (opcional ?lote=ID para dejarlo elegido)
 * /registrar?labor=ID     → editar esa labor
 * /registrar?duplicar=ID  → labor nueva con los datos de otra (misma mezcla, fecha de hoy)
 */
export default async function Registrar({ searchParams }: PageProps<"/registrar">) {
  const { lote, labor: editar, duplicar } = await searchParams;
  const datos = await obtenerDatos();

  const idOrigen = Number(typeof editar === "string" ? editar : typeof duplicar === "string" ? duplicar : NaN);
  const modo = typeof editar === "string" ? "editar" : typeof duplicar === "string" ? "duplicar" : "nueva";

  let inicial: ValoresIniciales | undefined;
  if (modo !== "nueva") {
    const origen = datos.labores.find((l) => l.id === idOrigen);
    if (!origen) notFound();
    inicial = {
      loteId: origen.loteId,
      fecha: modo === "editar" ? origen.fecha : undefined,
      tipoLaborId: origen.tipoLaborId,
      ha: origen.ha,
      costoLaborHa: origen.costoLaborHa,
      aporte: origen.aporte,
      notas: modo === "editar" ? (origen.notas ?? "") : "",
      insumos: origen.insumos,
    };
  } else if (typeof lote === "string") {
    const elegido = datos.lotes.find((l) => l.id === Number(lote));
    if (elegido) inicial = { loteId: elegido.id, ha: elegido.ha };
  }

  const titulos = {
    nueva: ["Registrar labor", "Los campos con * son obligatorios"],
    editar: ["Editar labor", "Los cambios reemplazan la labor guardada"],
    duplicar: ["Duplicar labor", "Revisá lote y fecha antes de guardar"],
  } as const;

  return (
    <>
      <Encabezado
        volver={modo === "nueva" ? "/inicio" : "/historial"}
        titulo={titulos[modo][0]}
        subtitulo={titulos[modo][1]}
      />
      <FormularioLabor
        // Cambiar de labor (o pasar de editar a nueva) tiene que reiniciar el formulario.
        key={`${modo}-${idOrigen}-${lote ?? ""}`}
        campos={datos.campos}
        lotes={datos.lotes}
        productos={datos.productos}
        aportes={datos.aportes}
        tiposLabor={datos.tiposLabor.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          tarifa: tarifaUsdHa(t, datos.cotizacion),
          detalle:
            t.cotizacion === "litros_gasoil" ? `${t.litrosGasoilHa ?? 0} L de gasoil/ha` : "Costo fijo",
        }))}
        inicial={inicial}
        laborId={modo === "editar" ? idOrigen : undefined}
      />
    </>
  );
}
