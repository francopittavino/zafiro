import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { tarifaUsdHa } from "@/lib/calculos";
import { listarRecetas } from "@/lib/recetas";
import { ordenPorId } from "@/lib/ordenes";
import { FormularioOrden } from "../formulario-orden";

/**
 * /ordenes/nueva            → orden nueva (opcional ?lote=ID o ?receta=ID para arrancar desde una receta)
 * /ordenes/nueva?orden=ID   → editar esa orden
 */
export default async function NuevaOrden({ searchParams }: PageProps<"/ordenes/nueva">) {
  const { lote, receta, orden: editar } = await searchParams;
  const [datos, recetas] = await Promise.all([obtenerDatos(), listarRecetas()]);
  const inicial = typeof editar === "string" ? await ordenPorId(Number(editar)) : undefined;
  if (inicial === null) notFound();

  return (
    <>
      <Encabezado
        volver={inicial ? `/ordenes/${inicial.id}` : "/ordenes"}
        titulo={inicial ? `Editar orden N° ${inicial.numero}` : "Nueva orden de trabajo"}
        subtitulo={inicial ? undefined : "El número se asigna solo al guardar"}
      />
      <FormularioOrden
        key={inicial?.id ?? `nueva-${lote ?? ""}-${receta ?? ""}`}
        campos={datos.campos}
        lotes={datos.lotes}
        productos={datos.productos}
        tiposLabor={datos.tiposLabor.map((t) => ({ id: t.id, nombre: t.nombre, tarifa: tarifaUsdHa(t, datos.cotizacion) }))}
        contratistas={(datos.contratistas ?? []).map((c) => c.nombre)}
        recetas={recetas
          .filter((r) => r.estado !== "anulada" || r.id === inicial?.recetaId)
          .map((r) => ({ id: r.id, numero: r.numero, loteId: r.loteId, fecha: r.fecha, objetivo: r.plagaObjetivo, items: r.items }))}
        inicial={inicial}
        loteInicial={typeof lote === "string" ? Number(lote) : undefined}
        recetaInicial={typeof receta === "string" ? Number(receta) : undefined}
      />
    </>
  );
}
