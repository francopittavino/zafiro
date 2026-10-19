import "server-only";
import { Text, View } from "@react-pdf/renderer";
import type { MapaConLotes } from "@/lib/fotos";
import type { OrdenDetallada } from "@/lib/ordenes";
import type { DatosIngeniero } from "@/lib/recetas";
import { fechaCorta, num, usd2 } from "@/lib/formato";
import { Datos, Documento, Hoja, Seccion, Tabla, estilos, type Logo } from "./comun";
import { MapaCampoPdf } from "./mapa";
import { Firma, SeccionReceta } from "./receta";

/**
 * Orden de trabajo para mandar al productor antes de hacer el trabajo: campo y lote (con el mapa),
 * la labor, los productos, el costo estimado (si se eligió mostrarlo) y la receta, si hay.
 */
export function OrdenPdf({
  detalle,
  mapa,
  logo,
  ingeniero,
}: {
  detalle: OrdenDetallada;
  mapa: MapaConLotes | null;
  logo: Logo;
  ingeniero: DatosIngeniero;
}) {
  const { orden: o, lote, campo, productor, receta, tipoLabor, costos, productos } = detalle;
  const titulo = `Orden de trabajo N° ${o.numero}`;
  const nombreLote = lote ? `${lote.codigo} ${lote.nombre}`.trim() : "";
  const porHa = (v: number) => usd2(v / o.ha);
  const trabajo =
    o.cobro === "hora"
      ? `${num(o.horas ?? 0)} h × ${usd2(o.costoHora ?? 0)} USD/h`
      : `${num(o.ha)} ha × ${usd2(o.costoLaborHa ?? 0)} USD/ha`;
  const subtitulo = [
    fechaCorta(o.fecha),
    o.fechaPrevista && `Hacer el ${fechaCorta(o.fechaPrevista)}`,
    o.estado === "anulada" && "ANULADA",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Documento titulo={`${titulo} · ${nombreLote}`}>
      <Hoja titulo={titulo} subtitulo={subtitulo} logo={logo} ingeniero={ingeniero}>
        <Seccion titulo="Campo y lote">
          <Datos
            datos={[
              { nombre: "Productor", valor: productor?.nombre },
              { nombre: "Campo", valor: campo?.nombre },
              { nombre: "Localidad", valor: [campo?.localidad, campo?.provincia].filter(Boolean).join(", ") },
              { nombre: "Lote", valor: nombreLote },
              { nombre: "Cultivo", valor: lote?.cultivo },
              { nombre: "Variedad / híbrido", valor: lote?.variedad },
            ]}
          />
          {mapa && lote && (
            <View style={{ marginTop: 8 }}>
              <MapaCampoPdf mapa={mapa} resaltado={lote.id} alto={230} />
            </View>
          )}
        </Seccion>

        <Seccion titulo="Trabajo a realizar">
          <Datos
            datos={[
              { nombre: "Labor", valor: tipoLabor },
              { nombre: "Superficie", valor: `${num(o.ha)} ha` },
              { nombre: "Fecha prevista", valor: o.fechaPrevista && fechaCorta(o.fechaPrevista) },
              {
                nombre: "La hace",
                valor:
                  o.modalidad === "contratista"
                    ? `Contratista${o.contratista ? `: ${o.contratista}` : ""}`
                    : o.modalidad === "propia"
                      ? "Máquina propia"
                      : null,
              },
              { nombre: "Receta", valor: receta && `N° ${receta.receta.numero}` },
            ]}
          />
          {o.instrucciones && (
            <Text style={[estilos.parrafo, { marginTop: 6 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Instrucciones: </Text>
              {o.instrucciones}
            </Text>
          )}
          {o.observaciones && (
            <Text style={[estilos.parrafo, { marginTop: 4 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Observaciones: </Text>
              {o.observaciones}
            </Text>
          )}
        </Seccion>

        <Seccion titulo="Productos">
          {productos.length === 0 ? (
            <Text style={estilos.parrafo}>Sin productos.</Text>
          ) : o.mostrarCostos ? (
            <Tabla
              columnas={[
                { titulo: "Producto", ancho: 3.4 },
                { titulo: "Dosis/ha", ancho: 1.4, derecha: true },
                { titulo: "Cantidad", ancho: 1.5, derecha: true },
                { titulo: "USD/unidad", ancho: 1.4, derecha: true },
                { titulo: "USD/ha", ancho: 1.2, derecha: true },
                { titulo: "USD", ancho: 1.4, derecha: true },
              ]}
              filas={productos.map((p) => [
                p.nombre,
                `${num(p.dosis, 3)} ${p.unidad}`,
                `${num(p.total)} ${p.unidad}`,
                usd2(p.precio),
                usd2(p.dosis * p.precio),
                usd2(p.importe),
              ])}
              total={["Total insumos", "", "", "", porHa(costos.insumos), usd2(costos.insumos)]}
            />
          ) : (
            <Tabla
              columnas={[
                { titulo: "Producto", ancho: 4 },
                { titulo: "Principio activo", ancho: 3.4 },
                { titulo: "Dosis/ha", ancho: 1.5, derecha: true },
                { titulo: "Cantidad", ancho: 1.6, derecha: true },
              ]}
              filas={productos.map((p) => [
                p.nombre,
                p.principioActivo ?? "—",
                `${num(p.dosis, 3)} ${p.unidad}`,
                `${num(p.total)} ${p.unidad}`,
              ])}
            />
          )}
        </Seccion>

        {o.mostrarCostos && (
          // Título, tabla y totales juntos: si no entran, pasan enteros a la hoja siguiente.
          <View wrap={false}>
            <Seccion titulo="Costo estimado">
              <Tabla
                columnas={[
                  { titulo: "Concepto", ancho: 2.5 },
                  { titulo: "Cálculo", ancho: 3.5 },
                  { titulo: "USD/ha", ancho: 1.4, derecha: true },
                  { titulo: "USD", ancho: 1.6, derecha: true },
                ]}
                filas={[
                  ["Insumos", `${productos.length} productos`, porHa(costos.insumos), usd2(costos.insumos)],
                  [`Labor${tipoLabor ? ` (${tipoLabor})` : ""}`, trabajo, porHa(costos.trabajo), usd2(costos.trabajo)],
                  ...o.gastos.map((g) => [g.concepto, "", porHa(g.importe), usd2(g.importe)]),
                ]}
                total={["Total estimado", "", porHa(costos.total), usd2(costos.total)]}
              />
              <View style={[estilos.tarjetas, { marginTop: 8 }]} wrap={false}>
                <View style={estilos.tarjetaFuerte}>
                  <Text style={[estilos.etiqueta, { color: "white" }]}>Total estimado</Text>
                  <Text style={estilos.numeroGrande}>USD {usd2(costos.total)}</Text>
                </View>
                <View style={estilos.tarjeta}>
                  <Text style={estilos.etiqueta}>Por hectárea</Text>
                  <Text style={estilos.numeroGrande}>{porHa(costos.total)} USD/ha</Text>
                </View>
              </View>
            </Seccion>
          </View>
        )}

        {receta && <SeccionReceta receta={receta} />}

        <Firma
          ingeniero={ingeniero}
          aclaracion={
            o.mostrarCostos
              ? "Los costos son estimados, con los precios de hoy. El costo real sale de la labor registrada."
              : "Orden de trabajo emitida por el ingeniero agrónomo."
          }
        />
      </Hoja>
    </Documento>
  );
}
