import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { armarInforme, leerFiltro } from "@/lib/informe";
import { datosIngeniero } from "@/lib/recetas";
import { fotosDe, mapaDelLote, mapasConLotes } from "@/lib/fotos";
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

  // Informe de un solo lote (filtro de lote o cierre de un cultivo): solo sus fotos y su mapa.
  const loteId = informe.lote?.id ?? informe.ciclo?.loteId;
  const lote = informe.datos.lotes.find((l) => l.id === loteId);

  // La foto más reciente del lote, o la de cada campo si el informe abarca campos enteros.
  const fotos: FotoPdf[] = [];
  const campos = [...new Set(informe.filas.map((f) => f.campoId))];
  const destinos = lote
    ? [{ tipo: "lote" as const, id: lote.id, titulo: `Lote ${lote.codigo} ${lote.nombre}`.trim() }]
    : campos.slice(0, MAXIMO_FOTOS).map((id) => ({
        tipo: "campo" as const,
        id,
        titulo: informe.datos.campos.find((c) => c.id === id)?.nombre ?? "Campo",
      }));
  for (const d of destinos) {
    // Las fotos que se usan de mapa ya salen en la sección Mapa: no se repiten.
    const lista = (await fotosDe({ tipo: d.tipo, id: d.id })).fotos.filter((f) => !f.esMapa);
    if (lista[0]) fotos.push({ titulo: d.titulo, url: lista[0].url, ancho: lista[0].ancho, alto: lista[0].alto });
  }

  // De un lote: el mapa donde está marcado (resaltado). Si no, los mapas de los campos con todos sus lotes.
  const mapas: MapaPdf[] = [];
  if (lote) {
    const campo = informe.datos.campos.find((c) => c.id === lote.campoId);
    const mapa = await mapaDelLote(lote, campo, informe.datos.lotes);
    if (mapa) mapas.push(mapa);
  } else {
    for (const campo of informe.datos.campos.filter((c) => campos.includes(c.id))) {
      mapas.push(...(await mapasConLotes(campo, informe.datos.lotes)));
    }
  }

  const [logo, ingeniero] = await Promise.all([cargarLogo(request.url), datosIngeniero()]);
  const pdf = await renderToBuffer(
    <InformePdf informe={informe} fotos={fotos} mapas={mapas} logo={logo} ingeniero={ingeniero} />,
  );
  const nombre = `${informe.encabezado} ${informe.titulo}.pdf`.replace(/\//g, "-");
  return respuestaPdf(pdf, nombre);
}
