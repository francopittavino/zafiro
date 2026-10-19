import "server-only";
import { Image, Text, View } from "@react-pdf/renderer";
import type { MapaConLotes } from "@/lib/fotos";
import type { armarInforme } from "@/lib/informe";
import type { DatosIngeniero } from "@/lib/recetas";
import { NOMBRE_CATEGORIA, fechaCorta, num, usd } from "@/lib/formato";
import { COLOR, Datos, Documento, Hoja, Seccion, Tabla, estilos, type Logo } from "./comun";
import { MapaCampoPdf } from "./mapa";

type Informe = Awaited<ReturnType<typeof armarInforme>>;
export type FotoPdf = { titulo: string; url: string; ancho: number | null; alto: number | null };
export type MapaPdf = MapaConLotes;

export function InformePdf({
  informe,
  fotos,
  mapas,
  logo,
  ingeniero,
}: {
  informe: Informe;
  fotos: FotoPdf[];
  mapas: MapaPdf[];
  logo: Logo;
  ingeniero: DatosIngeniero;
}) {
  const { datos, totales, filas } = informe;
  const conCostos = filas.filter((f) => f.conMovimientos);
  const margenTotal = informe.margenes.reduce((t, m) => t + m.resultado.margen, 0);
  const haCosechadas = informe.margenes.reduce((t, m) => t + m.fila.lote.ha, 0);
  const titulo = informe.encabezado;
  const porCultivo = informe.agrupar("cultivo");
  const porCampo = informe.agrupar("campo");
  const porHa = (v: number, ha: number) => (ha ? usd(v / ha) : "—");

  return (
    <Documento titulo={`${titulo} · ${informe.titulo}`}>
      <Hoja titulo={titulo} subtitulo={informe.titulo} logo={logo} ingeniero={ingeniero}>
        {informe.productor && (
          <Datos
            datos={[
              { nombre: "Productor", valor: informe.productor.nombre },
              { nombre: "CUIT", valor: informe.productor.cuit },
              { nombre: "Localidad", valor: informe.productor.localidad },
            ]}
          />
        )}

        <View style={[estilos.tarjetas, { marginTop: 10 }]} wrap={false}>
          <View style={estilos.tarjetaFuerte}>
            <Text style={[estilos.etiqueta, { color: "white" }]}>Costo total</Text>
            <Text style={estilos.numeroGrande}>USD {usd(totales.total)}</Text>
          </View>
          <View style={estilos.tarjeta}>
            <Text style={estilos.etiqueta}>Costo por hectárea</Text>
            <Text style={estilos.numeroGrande}>{porHa(totales.total, totales.ha)} USD/ha</Text>
          </View>
          <View style={estilos.tarjeta}>
            <Text style={estilos.etiqueta}>Superficie</Text>
            <Text style={estilos.numeroGrande}>{usd(totales.ha)} ha</Text>
          </View>
          {informe.margenes.length > 0 && (
            <View style={estilos.tarjeta}>
              <Text style={estilos.etiqueta}>Margen bruto</Text>
              <Text style={[estilos.numeroGrande, { color: margenTotal < 0 ? COLOR.negativo : COLOR.positivo }]}>
                USD {usd(margenTotal)}
              </Text>
            </View>
          )}
        </View>

        {mapas.length > 0 && (
          <Seccion titulo={mapas.length > 1 ? "Mapas" : "Mapa"}>
            {mapas.map((m) => (
              <MapaCampoPdf key={m.foto.id} mapa={m} resaltado={informe.lote?.id ?? informe.ciclo?.loteId} />
            ))}
          </Seccion>
        )}

        <Seccion titulo="Composición del costo">
          <Tabla
            columnas={[
              { titulo: "Concepto", ancho: 3 },
              { titulo: "USD", ancho: 2, derecha: true },
              { titulo: "USD/ha", ancho: 2, derecha: true },
              { titulo: "%", ancho: 1, derecha: true },
            ]}
            filas={(
              [
                ["Insumos", totales.insumos],
                ["Labores", totales.labores],
                ["Cosecha", totales.cosecha],
                ["Otros gastos", totales.otros],
              ] as const
            )
              .filter(([, v]) => v > 0)
              .map(([t, v]) => [t, usd(v), porHa(v, totales.ha), totales.total ? num((v / totales.total) * 100, 0) : "0"])}
            total={["Total", usd(totales.total), porHa(totales.total, totales.ha), "100"]}
          />
        </Seccion>

        {/* Ej. un productor con el mismo cultivo repartido en varios campos. */}
        {porCampo.length > 1 && (
          <Seccion titulo="Resumen por cultivo y por campo">
            <View style={{ flexDirection: "row", gap: 12 }} wrap={false}>
              {(
                [
                  ["Cultivo", porCultivo],
                  ["Campo", porCampo],
                ] as const
              ).map(([nombre, grupos]) => (
                <View key={nombre} style={{ flex: 1 }}>
                  <Tabla
                    columnas={[
                      { titulo: nombre, ancho: 2.4 },
                      { titulo: "ha", ancho: 1, derecha: true },
                      { titulo: "USD", ancho: 1.4, derecha: true },
                      { titulo: "USD/ha", ancho: 1.2, derecha: true },
                    ]}
                    filas={grupos.map((g) => [g.nombre, usd(g.ha), usd(g.total), porHa(g.total, g.ha)])}
                  />
                </View>
              ))}
            </View>
          </Seccion>
        )}

        <Seccion titulo="Costos por lote">
          <Tabla
            columnas={[
              { titulo: "Campo", ancho: 2.2 },
              { titulo: "Lote", ancho: 2.2 },
              { titulo: "Cultivo", ancho: 1.6 },
              { titulo: "ha", ancho: 1, derecha: true },
              { titulo: "Insumos", ancho: 1.4, derecha: true },
              { titulo: "Labores y cosecha", ancho: 1.6, derecha: true },
              { titulo: "Otros", ancho: 1.2, derecha: true },
              { titulo: "Total", ancho: 1.5, derecha: true },
              { titulo: "USD/ha", ancho: 1.2, derecha: true },
            ]}
            filas={conCostos.map((f) => [
              f.campo,
              `${f.lote.codigo} ${f.lote.nombre}`.trim(),
              f.lote.cultivo || "—",
              usd(f.lote.ha),
              usd(f.costos.insumos),
              usd(f.costos.labores + f.costos.cosecha),
              usd(f.costos.otros),
              usd(f.costos.total),
              porHa(f.costos.total, f.lote.ha),
            ])}
            total={[
              "Total",
              "",
              "",
              usd(totales.ha),
              usd(totales.insumos),
              usd(totales.labores + totales.cosecha),
              usd(totales.otros),
              usd(totales.total),
              porHa(totales.total, totales.ha),
            ]}
          />
        </Seccion>

        {informe.margenes.length > 0 && (
          <Seccion titulo="Margen bruto">
            <Tabla
              columnas={[
                { titulo: "Lote", ancho: 2.6 },
                { titulo: "Cultivo", ancho: 1.5 },
                { titulo: "Rinde kg/ha", ancho: 1.4, derecha: true },
                { titulo: "Ingreso neto", ancho: 1.7, derecha: true },
                { titulo: "Costos", ancho: 1.5, derecha: true },
                { titulo: "Margen", ancho: 1.5, derecha: true },
                { titulo: "USD/ha", ancho: 1.2, derecha: true },
              ]}
              filas={informe.margenes.map(({ fila, cosecha, resultado }) => [
                `${fila.campo} · ${fila.lote.codigo} ${fila.lote.nombre}`.trim(),
                fila.lote.cultivo,
                num(cosecha.rindeKgHa, 0),
                usd(resultado.ingresoNeto),
                usd(resultado.costoTotal),
                usd(resultado.margen),
                porHa(resultado.margen, fila.lote.ha),
              ])}
              total={["Total", "", "", "", "", usd(margenTotal), porHa(margenTotal, haCosechadas)]}
            />
          </Seccion>
        )}

        {informe.consumo.length > 0 && (
          <Seccion titulo="Insumos aplicados">
            <Tabla
              columnas={[
                { titulo: "Producto", ancho: 4 },
                { titulo: "Tipo", ancho: 2 },
                { titulo: "Cantidad", ancho: 2, derecha: true },
                { titulo: "USD", ancho: 1.6, derecha: true },
              ]}
              filas={informe.consumo.map((c) => [
                c.nombre,
                NOMBRE_CATEGORIA[c.categoria],
                `${num(c.cantidad, 1)} ${c.unidad}`,
                usd(c.costo),
              ])}
            />
          </Seccion>
        )}

        {informe.gastos.length > 0 && (
          <Seccion titulo="Otros gastos">
            <Tabla
              columnas={[
                { titulo: "Fecha", ancho: 1.2 },
                { titulo: "Lote", ancho: 3 },
                { titulo: "Categoría", ancho: 2 },
                { titulo: "Detalle", ancho: 3 },
                { titulo: "USD", ancho: 1.4, derecha: true },
              ]}
              filas={informe.gastos.map((g) => [
                fechaCorta(g.fecha),
                `${g.campo} · ${g.lote.codigo} ${g.lote.nombre}`.trim(),
                g.categoria,
                [g.descripcion, g.prorrateado && "parte del gasto del campo"].filter(Boolean).join(" · "),
                usd(g.importe),
              ])}
            />
          </Seccion>
        )}

        {informe.recetas.length > 0 && (
          <Seccion titulo="Recetas">
            <Tabla
              columnas={[
                { titulo: "N°", ancho: 0.7 },
                { titulo: "Fecha", ancho: 1.2 },
                { titulo: "Lote", ancho: 2.6 },
                { titulo: "Objetivo", ancho: 2.2 },
                { titulo: "Productos", ancho: 4 },
              ]}
              filas={informe.recetas.map((r) => {
                const lote = datos.lotes.find((l) => l.id === r.loteId);
                return [
                  String(r.numero),
                  fechaCorta(r.fecha),
                  lote ? `${lote.codigo} ${lote.nombre}`.trim() : "",
                  r.plagaObjetivo ?? "—",
                  r.items
                    .map((i) => {
                      const p = datos.productos.find((x) => x.id === i.productoId);
                      return p ? `${p.nombre} ${num(i.dosis, 3)} ${p.unidad}/ha` : "";
                    })
                    .join("; "),
                ];
              })}
            />
          </Seccion>
        )}

        {/* El detalle es un anexo: siempre arranca en hoja nueva. */}
        <Seccion titulo="Detalle de labores" quiebre={informe.labores.length > 0}>
          {conCostos.map((f) => {
            const delLote = informe.labores
              .filter((l) => l.loteId === f.lote.id)
              .sort((a, b) => a.fecha.localeCompare(b.fecha));
            if (!delLote.length) return null;
            return (
              // Un lote con pocas labores no se parte entre hojas (el título quedaría solo al pie).
              <View key={f.lote.id} style={{ marginBottom: 10 }} wrap={delLote.length > 15}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.zafiro, marginBottom: 3 }} minPresenceAhead={30}>
                  {f.campo} · {f.lote.codigo} {f.lote.nombre} · {f.lote.cultivo} · {usd(f.lote.ha)} ha
                </Text>
                <Tabla
                  columnas={[
                    { titulo: "Fecha", ancho: 1.1 },
                    { titulo: "Labor", ancho: 2.4 },
                    { titulo: "Productos (dosis/ha)", ancho: 5 },
                    { titulo: "ha", ancho: 0.9, derecha: true },
                    { titulo: "USD", ancho: 1.3, derecha: true },
                  ]}
                  filas={delLote.map((l) => [
                    fechaCorta(l.fecha),
                    [l.tipo, l.contratista].filter(Boolean).join(" · "),
                    l.productos.map((p) => `${p.nombre} ${num(p.dosis, 3)} ${p.unidad}`).join("; ") || "—",
                    usd(l.ha),
                    usd(l.costo.total),
                  ])}
                />
              </View>
            );
          })}
          {informe.labores.length === 0 && <Text style={estilos.parrafo}>Sin labores cargadas.</Text>}
        </Seccion>

        {fotos.length > 0 && (
          <Seccion titulo="Fotos" quiebre>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {fotos.map((f) => (
                <View key={f.url} style={{ width: "48%" }} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML */}
                  <Image
                    src={f.url}
                    style={{
                      width: "100%",
                      height: f.ancho && f.alto ? undefined : 180,
                      aspectRatio: f.ancho && f.alto ? f.ancho / f.alto : undefined,
                      objectFit: "cover",
                      borderRadius: 3,
                    }}
                  />
                  <Text style={[estilos.subtitulo, { marginTop: 3 }]}>{f.titulo}</Text>
                </View>
              ))}
            </View>
          </Seccion>
        )}
      </Hoja>
    </Documento>
  );
}
