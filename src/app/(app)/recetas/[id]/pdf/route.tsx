import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { datosIngeniero, recetaDetallada } from "@/lib/recetas";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { RecetaPdf } from "@/pdf/receta";

/** PDF de la receta. Los route handlers no pasan por el layout: la sesión se valida acá. */
export async function GET(request: Request, { params }: RouteContext<"/recetas/[id]/pdf">) {
  await verificarSesion();
  const { id } = await params;
  const detalle = await recetaDetallada(Number(id));
  if (!detalle) return new Response("La receta no existe.", { status: 404 });

  const [logo, ingeniero] = await Promise.all([cargarLogo(request.url), datosIngeniero()]);
  const pdf = await renderToBuffer(<RecetaPdf detalle={detalle} logo={logo} ingeniero={ingeniero} />);
  return respuestaPdf(pdf, `Receta-${detalle.receta.numero}.pdf`);
}
