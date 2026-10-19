import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { laborDescontoStock, obtenerDatos } from "@/lib/datos";
import { tarifaUsdHa } from "@/lib/calculos";
import { mapasDeCampos } from "@/lib/fotos";
import { listarRecetas } from "@/lib/recetas";
import { ordenPorId } from "@/lib/ordenes";
import { FormularioLabor, type ValoresIniciales } from "./formulario-labor";

/**
 * /registrar              → labor nueva (opcional ?lote=ID para dejarlo elegido)
 * /registrar?labor=ID     → editar esa labor
 * /registrar?duplicar=ID  → labor nueva con los datos de otra (misma mezcla, fecha de hoy)
 * /registrar?orden=ID     → labor nueva con lo que dice la orden de trabajo (al guardar, la orden queda realizada)
 */
export default async function Registrar({ searchParams }: PageProps<"/registrar">) {
  const { lote, labor: editar, duplicar, orden: deOrden } = await searchParams;
  const datos = await obtenerDatos();
  const [mapas, recetas] = await Promise.all([mapasDeCampos(datos.campos.map((c) => c.id)), listarRecetas()]);

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
      modalidad: origen.modalidad,
      contratista: origen.contratista,
      cobro: origen.cobro,
      horas: origen.horas,
      costoHora: origen.costoHora,
      // Al duplicar se copia la mezcla y la forma de trabajo, no el clima ni los manchones.
      aplicacion: modo === "editar" ? origen.aplicacion : undefined,
      zonas: modo === "editar" ? origen.zonas : null,
      recetaId: modo === "editar" ? origen.recetaId : null,
      extras: modo === "editar" ? origen.extras : null,
      descontoStock: modo === "editar" ? await laborDescontoStock(origen.id) : true,
    };
  } else if (typeof deOrden === "string") {
    const orden = await ordenPorId(Number(deOrden));
    if (!orden) notFound();
    inicial = {
      loteId: orden.loteId,
      // Se registra cuando ya se hizo: la fecha es la de hoy (se puede cambiar).
      tipoLaborId: orden.tipoLaborId,
      ha: orden.ha,
      costoLaborHa: orden.costoLaborHa ?? undefined,
      notas: orden.instrucciones ?? "",
      insumos: orden.items,
      modalidad: orden.modalidad,
      contratista: orden.contratista,
      cobro: orden.cobro,
      horas: orden.horas,
      costoHora: orden.costoHora,
      recetaId: orden.recetaId,
      descontoStock: true,
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
        volver={typeof deOrden === "string" ? `/ordenes/${deOrden}` : modo === "nueva" ? "/inicio" : "/historial"}
        titulo={titulos[modo][0]}
        subtitulo={typeof deOrden === "string" && modo === "nueva" ? "Con los datos de la orden de trabajo: revisá lo que cambió" : titulos[modo][1]}
      />
      <FormularioLabor
        // Cambiar de labor (o pasar de editar a nueva) tiene que reiniciar el formulario.
        key={`${modo}-${idOrigen}-${lote ?? ""}-${deOrden ?? ""}`}
        campos={datos.campos}
        lotes={datos.lotes}
        productos={datos.productos}
        aportes={datos.aportes}
        contratistas={(datos.contratistas ?? []).map((c) => c.nombre)}
        personalizados={datos.camposPersonalizados ?? []}
        stock={datos.stock ?? []}
        mapas={Object.fromEntries(mapas.map((m) => [m.id, m]))}
        recetas={recetas
          .filter((r) => r.estado !== "anulada")
          .map((r) => ({ id: r.id, numero: r.numero, loteId: r.loteId, fecha: r.fecha, objetivo: r.plagaObjetivo, items: r.items }))}
        tiposLabor={datos.tiposLabor.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          tarifa: tarifaUsdHa(t, datos.cotizacion),
          detalle:
            t.cotizacion === "litros_gasoil" ? `${t.litrosGasoilHa ?? 0} L de gasoil/ha` : "Costo fijo",
        }))}
        inicial={inicial}
        laborId={modo === "editar" ? idOrigen : undefined}
        ordenId={modo === "nueva" && typeof deOrden === "string" ? Number(deOrden) : undefined}
      />
    </>
  );
}
