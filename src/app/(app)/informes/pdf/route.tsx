import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { armarInforme, leerFiltro } from "@/lib/informe";
import { datosIngeniero } from "@/lib/recetas";
import { fotosDe, mapasConLotes } from "@/lib/fotos";
import { cargarLogo, respuestaPdf } from "@/pdf/comun";
import { InformePdf, type FotoPdf, type MapaPdf } from "@/pdf/informe";

/** Hasta cuántas fotos entran (pesan ~0,4 MB cada una y el PDF se manda por WhatsApp). */
const MAXIMO_FOTOS = 6;

/**
 * /informes/pdf?productor=&campo=&lote=&cultivo= → informe de la campaña en PDF.
 * Los route handlers no pasan por el layout: la sesión se valida acá.
 */
export async function GET(request: Request) {
  await verificarSesion();
  const url = new URL(request.url);
  const informe = await armarInforme(leerFiltro(Object.fromEntries(url.searchParams)));

  // La foto más reciente de cada campo (y del lote, si el informe es de un solo lote).
  const fotos: FotoPdf[] = [];
  const campos = [...new Set(informe.filas.map((f) => f.campoId))];
  const destinos = [
    ...(informe.lote ? [{ tipo: "lote" as const, id: informe.lote.id, titulo: `Lote ${informe.lote.codigo} ${informe.lote.nombre}` }] : []),
    ...campos.map((id) => ({
      tipo: "campo" as const,
      id,
      titulo: informe.datos.campos.find((c) => c.id === id)?.nombre ?? "Campo",
    })),
  ].slice(0, MAXIMO_FOTOS);
  for (const d of destinos) {
    // Las fotos que se usan de mapa ya salen en la sección Mapa: no se repiten.
    const lista = (await fotosDe({ tipo: d.tipo, id: d.id })).fotos.filter((f) => !f.esMapa);
    if (lista[0]) fotos.push({ titulo: d.titulo, url: lista[0].url, ancho: lista[0].ancho, alto: lista[0].alto });
  }

  // Mapas de los campos del informe con todos sus lotes marcados (el del informe, resaltado).
  const mapas: MapaPdf[] = [];
  for (const campo of informe.datos.campos.filter((c) => campos.includes(c.id))) {
    mapas.push(...(await mapasConLotes(campo, informe.datos.lotes)));
  }

  const [logo, ingeniero] = await Promise.all([cargarLogo(request.url), datosIngeniero()]);
  const pdf = await renderToBuffer(
    <InformePdf informe={informe} fotos={fotos} mapas={mapas} logo={logo} ingeniero={ingeniero} />,
  );
  const nombre = `${informe.encabezado} ${informe.titulo}.pdf`.replace(/\//g, "-");
  return respuestaPdf(pdf, nombre);
}
