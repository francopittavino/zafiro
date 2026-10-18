import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos } from "@/lib/datos";
import { usd } from "@/lib/formato";
import { BotonesCamposLotes } from "@/components/app/altas";
import { ListaLotes } from "./lista-lotes";

export default async function Lotes() {
  const { campos, lotes, productores, camposPersonalizados } = await obtenerDatos();
  const haTotales = lotes.reduce((t, l) => t + l.ha, 0);

  return (
    <>
      <Encabezado
        titulo="Campos y lotes"
        subtitulo={`${campos.length} campos · ${lotes.length} lotes · ${usd(haTotales)} ha`}
        acciones={
          <BotonesCamposLotes campos={campos} productores={productores} personalizados={camposPersonalizados} />
        }
      />
      <ListaLotes campos={campos} lotes={lotes} />
    </>
  );
}
