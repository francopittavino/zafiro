import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { obtenerDatos } from "@/lib/datos";
import { laboresDetalladas } from "@/lib/consultas";
import { datosIngeniero, recetaDetallada } from "@/lib/recetas";
import { fotosDe, mapaConLotes } from "@/lib/fotos";
import { fechaCorta } from "@/lib/formato";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { LaborPdf } from "@/pdf/labor";

/** PDF de una labor para mandar al cliente. Los route handlers no pasan por el layout: la sesión se valida acá. */
export async function GET(request: Request, { params }: RouteContext<"/historial/[id]/pdf">) {
  await verificarSesion();
  const { id } = await params;
  const datos = await obtenerDatos();
  const base = datos.labores.find((l) => l.id === Number(id));
  const lote = base && datos.lotes.find((l) => l.id === base.loteId);
  if (!base || !lote) return new Response("La labor no existe.", { status: 404 });

  const delLote = await laboresDetalladas({ loteId: lote.id });
  const labor = delLote.find((l) => l.id === base.id)!;
  const campo = datos.campos.find((c) => c.id === lote.campoId);
  const productor = datos.productores?.find((p) => p.id === campo?.productorId);

  const [logo, ingeniero, receta, mapa, galeria] = await Promise.all([
    cargarLogo(request.url),
    datosIngeniero(),
    labor.recetaId ? recetaDetallada(labor.recetaId) : null,
    campo ? mapaConLotes(campo, datos.lotes) : null,
    fotosDe({ tipo: "lote", id: lote.id }),
  ]);
  const ultima = galeria.fotos[0];
  const foto = ultima
    ? { titulo: `${fechaCorta(ultima.fecha)}${ultima.nota ? ` · ${ultima.nota}` : ""}`, url: ultima.url, ancho: ultima.ancho, alto: ultima.alto }
    : null;

  const pdf = await renderToBuffer(
    <LaborPdf
      labor={labor}
      delLote={delLote}
      campania={datos.campania}
      lote={lote}
      campo={campo}
      productor={productor}
      receta={receta}
      mapa={mapa}
      foto={foto}
      personalizados={(datos.camposPersonalizados ?? []).filter((c) => c.entidad === "labor")}
      logo={logo}
      ingeniero={ingeniero}
    />,
  );
  return respuestaPdf(pdf, `${labor.tipo} ${lote.codigo || lote.nombre} ${labor.fecha}.pdf`);
}
