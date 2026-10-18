import "server-only";
import { Image, Text, View } from "@react-pdf/renderer";
import type { CampoPersonalizado, Campo, Lote, Productor } from "@/lib/datos";
import type { LaborDetalle } from "@/lib/consultas";
import type { MapaConLotes } from "@/lib/fotos";
import type { DatosIngeniero, recetaDetallada } from "@/lib/recetas";
import { valoresExtra } from "@/components/app/campos-extra";
import { fechaCorta, num, usd, usd2 } from "@/lib/formato";
import { COLOR, Datos, Documento, Hoja, Seccion, Tabla, estilos, type Logo } from "./comun";
import { MapaCampoPdf } from "./mapa";
import type { FotoPdf } from "./informe";

type Receta = NonNullable<Awaited<ReturnType<typeof recetaDetallada>>>;

/**
 * Parte de una labor para mandar al cliente: campo y lote (con el mapa), lo que se hizo,
 * los productos, el costo detallado, la receta con la que se aplicó y las demás labores del lote.
 */
export function LaborPdf({
  labor,
  delLote,
  campania,
  lote,
  campo,
  productor,
  receta,
  mapa,
  foto,
  personalizados,
  logo,
  ingeniero,
}: {
  labor: LaborDetalle;
  /** Todas las labores del lote en la campaña (incluida esta). */
  delLote: LaborDetalle[];
  campania: string;
  lote: Lote;
  campo?: Campo;
  productor?: Productor;
  receta: Receta | null;
  mapa: MapaConLotes | null;
  foto: FotoPdf | null;
  personalizados: CampoPersonalizado[];
  logo: Logo;
  ingeniero: DatosIngeniero;
}) {
  const titulo = `${labor.tipo} · ${fechaCorta(labor.fecha)}`;
  const nombreLote = `${lote.codigo} ${lote.nombre}`.trim();
  const a = labor.aplicacion;
  const trabajo =
    labor.cobro === "hora"
      ? `${num(labor.horas ?? 0)} h × ${usd2(labor.costoHora ?? 0)} USD/h`
      : `${num(labor.ha)} ha × ${usd2(labor.costoLaborHa)} USD/ha`;
  const porHa = (v: number) => (labor.ha ? usd2(v / labor.ha) : "—");
  const ordenadas = [...delLote].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.id - y.id);
  const totalLote = ordenadas.reduce((t, l) => t + l.costo.total, 0);

  return (
    <Documento titulo={`${titulo} · ${nombreLote}`}>
      <Hoja titulo={titulo} subtitulo={`${campo?.nombre ?? ""} · Lote ${nombreLote} · Campaña ${campania}`} logo={logo} ingeniero={ingeniero}>
        <Seccion titulo="Campo y lote">
          <Datos
            datos={[
              { nombre: "Productor", valor: productor?.nombre },
              { nombre: "Campo", valor: campo?.nombre },
              { nombre: "Localidad", valor: [campo?.localidad, campo?.provincia].filter(Boolean).join(", ") },
              { nombre: "Lote", valor: nombreLote },
              { nombre: "Cultivo", valor: lote.cultivo },
              { nombre: "Variedad / híbrido", valor: lote.variedad },
              { nombre: "Superficie del lote", valor: `${num(lote.ha)} ha` },
            ]}
          />
          {mapa && (
            <View style={{ marginTop: 8 }}>
              <MapaCampoPdf mapa={mapa} resaltado={lote.id} zonas={labor.zonas ?? []} alto={250} />
            </View>
          )}
        </Seccion>

        <Seccion titulo="Labor">
          <Datos
            datos={[
              { nombre: "Fecha", valor: fechaCorta(labor.fecha) },
              { nombre: "Labor", valor: labor.tipo },
              { nombre: "Superficie trabajada", valor: `${num(labor.ha)} ha${labor.zonas?.length ? " (en manchones)" : ""}` },
              {
                nombre: "Realizada por",
                valor:
                  labor.modalidad === "contratista"
                    ? `Contratista${labor.contratista ? `: ${labor.contratista}` : ""}`
                    : labor.modalidad === "propia"
                      ? "Máquina propia"
                      : null,
              },
              { nombre: "Caudal", valor: a?.caudalLHa != null ? `${num(a.caudalLHa)} L/ha` : null },
              { nombre: "Temperatura", valor: a?.temperatura != null ? `${num(a.temperatura, 1)} °C` : null },
              { nombre: "Humedad", valor: a?.humedad != null ? `${num(a.humedad, 1)} %` : null },
              {
                nombre: "Viento",
                valor:
                  a?.vientoKmH != null ? `${num(a.vientoKmH, 1)} km/h${a.vientoDireccion ? ` ${a.vientoDireccion}` : ""}` : null,
              },
              { nombre: "Aplicador", valor: a?.aplicador },
              ...valoresExtra(personalizados, labor.extras),
            ]}
          />
          {labor.notas && <Text style={[estilos.parrafo, { marginTop: 6 }]}>{labor.notas}</Text>}
        </Seccion>

        <Seccion titulo="Productos aplicados">
          {labor.productos.length === 0 ? (
            <Text style={estilos.parrafo}>Labor sin productos.</Text>
          ) : (
            <Tabla
              columnas={[
                { titulo: "Producto", ancho: 3.4 },
                { titulo: "Dosis/ha", ancho: 1.4, derecha: true },
                { titulo: "Cantidad", ancho: 1.5, derecha: true },
                { titulo: "USD/unidad", ancho: 1.4, derecha: true },
                { titulo: "USD/ha", ancho: 1.2, derecha: true },
                { titulo: "USD", ancho: 1.4, derecha: true },
              ]}
              filas={labor.productos.map((p) => [
                p.nombre,
                `${num(p.dosis, 3)} ${p.unidad}`,
                `${num(p.dosis * labor.ha)} ${p.unidad}`,
                usd2(p.precio),
                usd2(p.dosis * p.precio),
                usd2(p.dosis * p.precio * labor.ha),
              ])}
              total={["Total insumos", "", "", "", porHa(labor.costo.insumos), usd2(labor.costo.insumos)]}
            />
          )}
        </Seccion>

        {/* Título, tabla y totales juntos: si no entran, pasan enteros a la hoja siguiente. */}
        <View wrap={false}>
          <Seccion titulo="Detalle del costo">
            <Tabla
              columnas={[
                { titulo: "Concepto", ancho: 2.5 },
                { titulo: "Cálculo", ancho: 3.5 },
                { titulo: "USD/ha", ancho: 1.4, derecha: true },
                { titulo: "USD", ancho: 1.6, derecha: true },
              ]}
              filas={[
                ["Insumos", `${labor.productos.length} productos`, porHa(labor.costo.insumos), usd2(labor.costo.insumos)],
                [`Labor (${labor.tipo})`, trabajo, porHa(labor.costo.trabajo), usd2(labor.costo.trabajo)],
              ]}
              total={["Total de la labor", "", porHa(labor.costo.total), usd2(labor.costo.total)]}
            />
            <View style={[estilos.tarjetas, { marginTop: 8 }]} wrap={false}>
              <View style={estilos.tarjetaFuerte}>
                <Text style={[estilos.etiqueta, { color: "white" }]}>Total de la labor</Text>
                <Text style={estilos.numeroGrande}>USD {usd2(labor.costo.total)}</Text>
              </View>
              <View style={estilos.tarjeta}>
                <Text style={estilos.etiqueta}>Por hectárea</Text>
                <Text style={estilos.numeroGrande}>{porHa(labor.costo.total)} USD/ha</Text>
              </View>
            </View>
          </Seccion>
        </View>

        {receta && (
          <Seccion titulo={`Receta N° ${receta.receta.numero}`}>
            <Datos
              datos={[
                { nombre: "Fecha", valor: fechaCorta(receta.receta.fecha) },
                { nombre: "Receta oficial N°", valor: receta.receta.numeroOficial },
                { nombre: "Objetivo", valor: receta.receta.plagaObjetivo },
                { nombre: "Tipo de aplicación", valor: receta.receta.tipoAplicacion },
                { nombre: "Caudal", valor: receta.receta.caudalLHa != null ? `${num(receta.receta.caudalLHa)} L/ha` : null },
              ]}
            />
            {receta.productos.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Tabla
                  columnas={[
                    { titulo: "Producto recetado", ancho: 3 },
                    { titulo: "Principio activo", ancho: 3 },
                    { titulo: "Banda", ancho: 1.2 },
                    { titulo: "Carencia", ancho: 1.1, derecha: true },
                    { titulo: "Dosis/ha", ancho: 1.4, derecha: true },
                  ]}
                  filas={receta.productos.map((p) => [
                    p.nombre,
                    [p.principioActivo, p.concentracion].filter(Boolean).join(" ") || "—",
                    p.bandaToxicologica ?? "—",
                    p.carenciaDias != null ? `${p.carenciaDias} d` : "—",
                    `${num(p.dosis, 3)} ${p.unidad}`,
                  ])}
                />
              </View>
            )}
            {[
              ["Recomendaciones", receta.receta.recomendaciones],
              ["Condiciones y distancias", receta.receta.condiciones],
            ].map(
              ([t, texto]) =>
                texto && (
                  <Text key={t} style={[estilos.parrafo, { marginTop: 6 }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{t}: </Text>
                    {texto}
                  </Text>
                ),
            )}
          </Seccion>
        )}

        {ordenadas.length > 1 && (
          <Seccion titulo={`Labores del lote en la campaña ${campania}`}>
            <Tabla
              columnas={[
                { titulo: "Fecha", ancho: 1.1 },
                { titulo: "Labor", ancho: 2.4 },
                { titulo: "Productos (dosis/ha)", ancho: 4.6 },
                { titulo: "ha", ancho: 0.9, derecha: true },
                { titulo: "USD", ancho: 1.3, derecha: true },
              ]}
              filas={ordenadas.map((l) => [
                fechaCorta(l.fecha),
                `${l.id === labor.id ? "» " : ""}${[l.tipo, l.contratista].filter(Boolean).join(" · ")}`,
                l.productos.map((p) => `${p.nombre} ${num(p.dosis, 3)} ${p.unidad}`).join("; ") || "—",
                usd(l.ha),
                usd(l.costo.total),
              ])}
              total={["Total", "", `${usd(lote.ha ? totalLote / lote.ha : 0)} USD/ha`, "", usd(totalLote)]}
            />
            <Text style={[estilos.subtitulo, { marginTop: 3 }]}>» Labor de este informe.</Text>
          </Seccion>
        )}

        {foto && (
          <Seccion titulo="Foto del lote">
            <View wrap={false}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML */}
              <Image
                src={foto.url}
                style={{
                  width: foto.ancho && foto.alto ? Math.min(523, (260 * foto.ancho) / foto.alto) : 523,
                  height: 260,
                  objectFit: "cover",
                  borderRadius: 3,
                }}
              />
              <Text style={[estilos.subtitulo, { marginTop: 3, color: COLOR.gris }]}>{foto.titulo}</Text>
            </View>
          </Seccion>
        )}
      </Hoja>
    </Documento>
  );
}
