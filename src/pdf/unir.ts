import "server-only";
import { PDFDocument } from "pdf-lib";
import { descargarArchivo } from "@/lib/almacenamiento";

/**
 * Pega al final de un PDF generado el PDF de la receta oficial (guardado en "documentos").
 * Si el oficial no se puede leer, devuelve el original: mejor el resumen solo que un error.
 */
export async function agregarRecetaOficial(pdf: Buffer, ruta: string | null | undefined): Promise<Buffer> {
  if (!ruta) return pdf;
  try {
    const oficial = await PDFDocument.load(await descargarArchivo(ruta, "documentos"), { ignoreEncryption: true });
    const unido = await PDFDocument.load(pdf);
    for (const hoja of await unido.copyPages(oficial, oficial.getPageIndices())) unido.addPage(hoja);
    return Buffer.from(await unido.save());
  } catch (error) {
    console.error("[receta oficial]", error);
    return pdf;
  }
}
