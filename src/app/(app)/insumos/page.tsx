import { Encabezado } from "@/components/app/encabezado";
import { historialPrecios, obtenerDatos } from "@/lib/datos";
import { BotonNuevoInsumo } from "@/components/app/altas";
import { ListaInsumos } from "./lista-insumos";

export default async function Insumos() {
  const [{ productos }, historial] = await Promise.all([obtenerDatos(), historialPrecios()]);

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Insumos y precios"
        subtitulo={`${productos.length} productos · precios en USD`}
        acciones={<BotonNuevoInsumo />}
      />
      <ListaInsumos productos={productos} historial={historial} />
    </>
  );
}
