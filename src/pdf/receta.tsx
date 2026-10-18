import "server-only";
import { Text, View } from "@react-pdf/renderer";
import type { recetaDetallada, DatosIngeniero } from "@/lib/recetas";
import { valoresExtra } from "@/components/app/campos-extra";
import { fechaCorta, num } from "@/lib/formato";
import { COLOR, Datos, Documento, Hoja, Seccion, Tabla, estilos, type Logo } from "./comun";

type Detalle = NonNullable<Awaited<ReturnType<typeof recetaDetallada>>>;

/** Resumen de la receta fitosanitaria (no reemplaza a la oficial de Entre Ríos). */
export function RecetaPdf({ detalle, logo, ingeniero }: { detalle: Detalle; logo: Logo; ingeniero: DatosIngeniero }) {
  const { receta: r, lote, campo, productor, ha, productos, personalizados } = detalle;
  const titulo = `Receta agronómica N° ${r.numero}`;
  return (
    <Documento titulo={titulo}>
      <Hoja
        titulo={titulo}
        subtitulo={`${fechaCorta(r.fecha)}${r.numeroOficial ? ` · Receta oficial N° ${r.numeroOficial}` : ""}${r.estado === "anulada" ? " · ANULADA" : ""}`}
        logo={logo}
        ingeniero={ingeniero}
      >
        <Seccion titulo="Lote">
          <Datos
            datos={[
              { nombre: "Productor", valor: productor?.nombre },
              { nombre: "Campo", valor: campo?.nombre },
              { nombre: "Localidad", valor: [campo?.localidad, campo?.provincia].filter(Boolean).join(", ") },
              { nombre: "Lote", valor: lote && `${lote.codigo} ${lote.nombre}`.trim() },
              { nombre: "Cultivo", valor: lote?.cultivo },
              { nombre: "Superficie", valor: `${num(ha)} ha` },
            ]}
          />
        </Seccion>

        <Seccion titulo="Aplicación">
          <Datos
            datos={[
              { nombre: "Objetivo", valor: r.plagaObjetivo },
              { nombre: "Tipo de aplicación", valor: r.tipoAplicacion },
              { nombre: "Caudal", valor: r.caudalLHa != null ? `${num(r.caudalLHa)} L/ha` : null },
              { nombre: "Aplicar a partir del", valor: r.fechaAplicacionPrevista && fechaCorta(r.fechaAplicacionPrevista) },
              ...valoresExtra(personalizados, r.extras),
            ]}
          />
        </Seccion>

        <Seccion titulo="Productos">
          {productos.length === 0 ? (
            <Text style={estilos.parrafo}>Sin productos.</Text>
          ) : (
            <Tabla
              columnas={[
                { titulo: "Producto", ancho: 3 },
                { titulo: "Principio activo", ancho: 3 },
                { titulo: "Banda", ancho: 1.3 },
                { titulo: "Carencia", ancho: 1.2, derecha: true },
                { titulo: "Dosis/ha", ancho: 1.5, derecha: true },
                { titulo: "Total", ancho: 1.5, derecha: true },
              ]}
              filas={productos.map((p) => [
                p.nombre,
                [p.principioActivo, p.concentracion].filter(Boolean).join(" ") || "—",
                p.bandaToxicologica ?? "—",
                p.carenciaDias != null ? `${p.carenciaDias} d` : "—",
                `${num(p.dosis, 3)} ${p.unidad}`,
                `${num(p.total)} ${p.unidad}`,
              ])}
            />
          )}
        </Seccion>

        {[
          ["Recomendaciones", r.recomendaciones],
          ["Condiciones y distancias", r.condiciones],
          ["Observaciones", r.observaciones],
        ].map(
          ([t, texto]) =>
            texto && (
              <Seccion key={t} titulo={t!}>
                <Text style={estilos.parrafo}>{texto}</Text>
              </Seccion>
            ),
        )}

        <View style={{ marginTop: 40, flexDirection: "row", justifyContent: "flex-end" }} wrap={false}>
          <View style={{ width: 200, borderTopWidth: 0.8, borderTopColor: COLOR.texto, paddingTop: 4, alignItems: "center" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{ingeniero.ingeniero_nombre || "Ingeniero agrónomo"}</Text>
            {ingeniero.ingeniero_matricula && (
              <Text style={estilos.subtitulo}>Matrícula {ingeniero.ingeniero_matricula}</Text>
            )}
          </View>
        </View>
        <Text style={[estilos.subtitulo, { marginTop: 16 }]}>
          Resumen de la receta agronómica. No reemplaza a la receta fitosanitaria oficial.
        </Text>
      </Hoja>
    </Documento>
  );
}
