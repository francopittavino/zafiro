import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { datosIngeniero, recetaDetallada } from "@/lib/recetas";
import { obtenerDatos } from "@/lib/datos";
import { mapaConLotes } from "@/lib/fotos";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { RecetaPdf } from "@/pdf/receta";
import { agregarRecetaOficial } from "@/pdf/unir";

/** PDF de la receta. Los route handlers no pasan por el layout: la sesión se valida acá. */
export async function GET(request: Request, { params }: RouteContext<"/recetas/[id]/pdf">) {
  await verificarSesion();
  const { id } = await params;
  const detalle = await recetaDetallada(Number(id));
  if (!detalle) return new Response("La receta no existe.", { status: 404 });

  const { campo } = detalle;
  const [logo, ingeniero, mapa] = await Promise.all([
    cargarLogo(request.url),
    datosIngeniero(),
    campo ? obtenerDatos().then((d) => mapaConLotes(campo, d.lotes)) : null,
  ]);
  const resumen = await renderToBuffer(<RecetaPdf detalle={detalle} mapa={mapa} logo={logo} ingeniero={ingeniero} />);
  // Resumen + receta oficial de la provincia en un solo PDF, para mandar todo junto.
  return respuestaPdf(await agregarRecetaOficial(resumen, detalle.receta.archivoOficial), `Receta-${detalle.receta.numero}.pdf`);
}
