import { renderToBuffer } from "@react-pdf/renderer";
import { verificarSesion } from "@/lib/sesion";
import { armarInforme, leerFiltro } from "@/lib/informe";
import { datosIngeniero } from "@/lib/recetas";
import { fotosDe, mapasDeCampos } from "@/lib/fotos";
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
    const { fotos: lista } = await fotosDe({ tipo: d.tipo, id: d.id });
    if (lista[0]) fotos.push({ titulo: d.titulo, url: lista[0].url, ancho: lista[0].ancho, alto: lista[0].alto });
  }

  // Mapas de los campos del informe que tienen lotes marcados sobre la foto.
  const fotosMapa = await mapasDeCampos(informe.datos.campos.filter((c) => campos.includes(c.id)));
  const mapas: MapaPdf[] = [...fotosMapa].flatMap(([campoId, foto]) => {
    const lotes = informe.filas
      .filter((f) => f.campoId === campoId && f.lote.dibujo)
      .map(({ lote: l }) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo! }));
    const campo = informe.datos.campos.find((c) => c.id === campoId)?.nombre ?? "Campo";
    return lotes.length ? [{ campo, foto, lotes }] : [];
  });

  const [logo, ingeniero] = await Promise.all([cargarLogo(request.url), datosIngeniero()]);
  const pdf = await renderToBuffer(
    <InformePdf informe={informe} fotos={fotos} mapas={mapas} logo={logo} ingeniero={ingeniero} />,
  );
  const nombre = `Informe ${informe.datos.campania.replace("/", "-")} ${informe.titulo}.pdf`;
  return respuestaPdf(pdf, nombre);
}
