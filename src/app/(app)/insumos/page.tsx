import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { BotonNuevoInsumo } from "@/components/app/altas";
import { ListaInsumos } from "./lista-insumos";

export default async function Insumos() {
  const { productos, proveedores = [], camposPersonalizados = [] } = await obtenerDatos();

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Insumos y precios"
        subtitulo={`${productos.length} productos · precios en USD`}
        acciones={<BotonNuevoInsumo proveedores={proveedores} personalizados={camposPersonalizados} />}
      />
      <ListaInsumos productos={productos} proveedores={proveedores} personalizados={camposPersonalizados} />
    </>
  );
}
