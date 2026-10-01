import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas } from "@/lib/consultas";
import { ListaHistorial } from "./lista-historial";

export default async function Historial() {
  const datos = await obtenerDatos();
  const labores = await laboresDetalladas();

  return (
    <>
      <Encabezado titulo="Historial de labores" subtitulo={`Campaña ${datos.campania}`} />
      <ListaHistorial labores={labores} campos={datos.campos.map((c) => c.nombre)} />
    </>
  );
}
