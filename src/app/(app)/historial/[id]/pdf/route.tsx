import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { labores } from "@/db/schema";
import { datosDe, obtenerDatos } from "@/lib/datos";
import { laboresDetalladas } from "@/lib/consultas";
import { datosIngeniero, recetaDetallada } from "@/lib/recetas";
import { fotosDe, mapaConLotes } from "@/lib/fotos";
import { fechaCorta } from "@/lib/formato";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { LaborPdf } from "@/pdf/labor";
import { agregarRecetaOficial } from "@/pdf/unir";

/** PDF de una labor para mandar al cliente. Los route handlers no pasan por el layout: la sesión se valida acá. */
export async function GET(request: Request, { params }: RouteContext<"/historial/[id]/pdf">) {
  await verificarSesion();
  const { id } = await params;
  let datos = await obtenerDatos();
  let base = datos.labores.find((l) => l.id === Number(id));
  if (!base && Number.isInteger(Number(id))) {
    // Labor de un cultivo ya cerrado: se cargan los datos de ese cultivo.
    const [fila] = await db.select({ cicloId: labores.cicloId }).from(labores).where(eq(labores.id, Number(id)));
    if (fila) {
      datos = await datosDe(`ciclo:${fila.cicloId}`);
      base = datos.labores.find((l) => l.id === Number(id));
    }
  }
  const lote = base && datos.lotes.find((l) => l.id === base.loteId);
  if (!base || !lote) return new Response("La labor no existe.", { status: 404 });

  const delLote = await laboresDetalladas({ loteId: lote.id }, datos);
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
  // Si la receta vinculada tiene el PDF oficial, va al final.
  return respuestaPdf(
    await agregarRecetaOficial(pdf, receta?.receta.archivoOficial),
    `${labor.tipo} ${lote.codigo || lote.nombre} ${labor.fecha}.pdf`,
  );
}
