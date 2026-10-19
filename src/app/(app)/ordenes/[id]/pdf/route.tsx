import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { datosIngeniero } from "@/lib/recetas";
import { obtenerDatos } from "@/lib/datos";
import { mapaDelLote } from "@/lib/fotos";
import { ordenDetallada } from "@/lib/ordenes";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { OrdenPdf } from "@/pdf/orden";
import { agregarRecetaOficial } from "@/pdf/unir";

/** PDF de la orden de trabajo. Los route handlers no pasan por el layout: la sesión se valida acá. */
export async function GET(request: Request, { params }: RouteContext<"/ordenes/[id]/pdf">) {
  await verificarSesion();
  const { id } = await params;
  const detalle = await ordenDetallada(Number(id));
  if (!detalle) return new Response("La orden no existe.", { status: 404 });

  const { lote, campo } = detalle;
  const [logo, ingeniero, mapa] = await Promise.all([
    cargarLogo(request.url),
    datosIngeniero(),
    lote ? obtenerDatos().then((d) => mapaDelLote(lote, campo, d.lotes)) : null,
  ]);
  const pdf = await renderToBuffer(<OrdenPdf detalle={detalle} mapa={mapa} logo={logo} ingeniero={ingeniero} />);
  // Si la receta tiene el PDF oficial de la provincia, va al final: se manda todo junto.
  return respuestaPdf(
    await agregarRecetaOficial(pdf, detalle.receta?.receta.archivoOficial),
    `Orden-${detalle.orden.numero} ${lote ? `${lote.codigo || lote.nombre}` : ""}.pdf`,
  );
}
