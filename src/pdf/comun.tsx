import "server-only";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DatosIngeniero } from "@/lib/recetas";

/**
 * Piezas comunes de los PDF con la marca Zafiro (colores del logo, ver globals.css).
 * Se usa Helvetica (incluida en el PDF) para no depender de bajar fuentes.
 */

export const COLOR = {
  marino: "#252A61",
  zafiro: "#0B63AE",
  zafiroSuave: "#E7F0F9",
  sol: "#FFE600",
  texto: "#1F2330",
  gris: "#6B7080",
  linea: "#D9DCE3",
  positivo: "#22703A",
  negativo: "#B42318",
};

export const estilos = StyleSheet.create({
  pagina: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 36, fontSize: 9, color: COLOR.texto, fontFamily: "Helvetica" },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  logo: { width: 52, height: 48 },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COLOR.marino },
  subtitulo: { fontSize: 9, color: COLOR.gris, marginTop: 2 },
  franja: { height: 3, backgroundColor: COLOR.sol, marginBottom: 12 },
  seccion: { marginTop: 12 },
  tituloSeccion: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: COLOR.marino,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.zafiro,
    paddingBottom: 3,
    marginBottom: 6,
  },
  grilla: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  dato: { width: "33.33%", paddingRight: 8 },
  etiqueta: { fontSize: 7, color: COLOR.gris, textTransform: "uppercase", letterSpacing: 0.4 },
  valor: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 1 },
  parrafo: { fontSize: 9, lineHeight: 1.4 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.linea, paddingVertical: 4 },
  filaCabecera: {
    flexDirection: "row",
    backgroundColor: COLOR.zafiroSuave,
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
    color: COLOR.marino,
    fontSize: 8,
  },
  filaTotal: { flexDirection: "row", paddingVertical: 5, fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: COLOR.marino },
  celda: { paddingHorizontal: 3 },
  derecha: { textAlign: "right" },
  pie: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLOR.gris,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.linea,
    paddingTop: 5,
  },
  tarjetas: { flexDirection: "row", gap: 8 },
  tarjeta: { flex: 1, backgroundColor: COLOR.zafiroSuave, borderRadius: 4, padding: 8 },
  tarjetaFuerte: { flex: 1, backgroundColor: COLOR.marino, borderRadius: 4, padding: 8, color: "white" },
  numeroGrande: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
});

/** Logo como datos (lo baja el route handler de /marca/logo-pdf.png). */
export type Logo = { data: Buffer; format: "png" } | null;

export function Hoja({
  titulo,
  subtitulo,
  logo,
  ingeniero,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  logo: Logo;
  ingeniero: DatosIngeniero;
  children: React.ReactNode;
}) {
  const firma = [ingeniero.ingeniero_nombre, ingeniero.ingeniero_matricula && `Mat. ${ingeniero.ingeniero_matricula}`]
    .filter(Boolean)
    .join(" · ");
  const contacto = [ingeniero.ingeniero_telefono, ingeniero.ingeniero_email].filter(Boolean).join(" · ");
  return (
    <Page size="A4" style={estilos.pagina}>
      <View style={estilos.encabezado} fixed>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML */}
        {logo && <Image src={logo} style={estilos.logo} />}
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {subtitulo && <Text style={estilos.subtitulo}>{subtitulo}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.marino, fontSize: 10 }}>Zafiro Agronomía</Text>
          {firma && <Text style={estilos.subtitulo}>{firma}</Text>}
          {contacto && <Text style={estilos.subtitulo}>{contacto}</Text>}
        </View>
      </View>
      <View style={estilos.franja} fixed />
      {children}
      <View style={estilos.pie} fixed>
        <Text>Zafiro Agronomía · {new Date().toLocaleDateString("es-AR")}</Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  );
}

export function Documento({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Document title={titulo} author="Zafiro Agronomía" creator="Zafiro" language="es-AR">
      {children}
    </Document>
  );
}

export function Datos({ datos }: { datos: { nombre: string; valor: string | null | undefined }[] }) {
  return (
    <View style={estilos.grilla}>
      {datos
        .filter((d) => d.valor)
        .map((d) => (
          <View key={d.nombre} style={estilos.dato}>
            <Text style={estilos.etiqueta}>{d.nombre}</Text>
            <Text style={estilos.valor}>{d.valor}</Text>
          </View>
        ))}
    </View>
  );
}

export function Seccion({ titulo, children, quiebre = false }: { titulo: string; children: React.ReactNode; quiebre?: boolean }) {
  return (
    <View style={estilos.seccion} break={quiebre} wrap>
      <Text style={estilos.tituloSeccion} minPresenceAhead={40}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

/** Tabla simple: columnas con ancho relativo y alineación. */
export function Tabla({
  columnas,
  filas,
  total,
}: {
  columnas: { titulo: string; ancho: number; derecha?: boolean }[];
  filas: (string | number)[][];
  total?: (string | number)[];
}) {
  const celda = (i: number) => [estilos.celda, { flex: columnas[i].ancho }, columnas[i].derecha ? estilos.derecha : {}];
  return (
    <View>
      <View style={estilos.filaCabecera} fixed>
        {columnas.map((c, i) => (
          <Text key={c.titulo} style={celda(i)}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {filas.map((f, n) => (
        <View key={n} style={estilos.fila} wrap={false}>
          {f.map((v, i) => (
            <Text key={i} style={celda(i)}>
              {v}
            </Text>
          ))}
        </View>
      ))}
      {total && (
        <View style={estilos.filaTotal} wrap={false}>
          {total.map((v, i) => (
            <Text key={i} style={celda(i)}>
              {v}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** Baja el logo liviano del propio sitio (en Vercel /public no está en el disco de la función). */
export async function cargarLogo(base: string): Promise<Logo> {
  try {
    const r = await fetch(new URL("/marca/logo-pdf.png", base));
    if (!r.ok) return null;
    return { data: Buffer.from(await r.arrayBuffer()), format: "png" };
  } catch {
    return null;
  }
}

/** Respuesta HTTP con el PDF: se abre en el navegador (y desde ahí se comparte o descarga). */
export function respuestaPdf(buffer: Buffer, nombre: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
