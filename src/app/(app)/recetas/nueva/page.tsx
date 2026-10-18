import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { recetaPorId } from "@/lib/recetas";
import { FormularioReceta } from "../formulario-receta";

/**
 * /recetas/nueva            → receta nueva (opcional ?lote=ID)
 * /recetas/nueva?receta=ID  → editar esa receta
 */
export default async function NuevaReceta({ searchParams }: PageProps<"/recetas/nueva">) {
  const { lote, receta: editar } = await searchParams;
  const datos = await obtenerDatos();
  const inicial = typeof editar === "string" ? await recetaPorId(Number(editar)) : undefined;
  if (inicial === null) notFound();

  return (
    <>
      <Encabezado
        volver={inicial ? `/recetas/${inicial.id}` : "/recetas"}
        titulo={inicial ? `Editar receta N° ${inicial.numero}` : "Nueva receta"}
        subtitulo={inicial ? undefined : "El número se asigna solo al guardar"}
      />
      <FormularioReceta
        key={inicial?.id ?? `nueva-${lote ?? ""}`}
        campos={datos.campos}
        lotes={datos.lotes}
        productos={datos.productos}
        personalizados={datos.camposPersonalizados ?? []}
        inicial={inicial}
        loteInicial={typeof lote === "string" ? Number(lote) : undefined}
      />
    </>
  );
}
