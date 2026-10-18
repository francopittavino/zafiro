import "server-only";
import { Image, Polygon, Svg, Text, View } from "@react-pdf/renderer";
import type { Dibujo } from "@/db/schema";
import type { MapaConLotes } from "@/lib/fotos";
import { centro } from "@/lib/dibujo";
import { colorCultivo } from "@/lib/colores-cultivo";
import { COLOR, estilos } from "./comun";

/** Lugar máximo del mapa en la hoja (A4 menos márgenes), en puntos. */
const ANCHO_MAPA = 523;
const ALTO_MAPA = 340;

const nombreCultivo = (cultivo: string) => cultivo.split("/").pop()?.trim() || "Sin cultivo";

/**
 * Foto del campo con los lotes pintados según el cultivo (coordenadas en puntos: react-pdf
 * no estira el SVG). Con `resaltado`, ese lote va con borde amarillo y los demás apagados;
 * `zonas` son manchones de una labor, en rojo punteado.
 */
export function MapaCampoPdf({
  mapa,
  resaltado,
  zonas = [],
  alto: altoMaximo = ALTO_MAPA,
}: {
  mapa: MapaConLotes;
  resaltado?: number;
  zonas?: Dibujo[];
  alto?: number;
}) {
  // Entra en el lugar disponible respetando la proporción de la foto.
  const escala = Math.min(ANCHO_MAPA / mapa.foto.ancho, altoMaximo / mapa.foto.alto);
  const ancho = mapa.foto.ancho * escala;
  const alto = mapa.foto.alto * escala;
  const puntos = (d: Dibujo) => d.map(([x, y]) => `${x * ancho},${y * alto}`).join(" ");
  const cultivos = [...new Set(mapa.lotes.map((l) => nombreCultivo(l.cultivo)))];
  const elegido = mapa.lotes.find((l) => l.id === resaltado);
  const apagado = (id: number) => elegido !== undefined && elegido.id !== id;
  return (
    <View wrap={false} style={{ marginBottom: 10 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.zafiro, marginBottom: 3 }}>{mapa.campo}</Text>
      <View style={{ position: "relative", width: ancho, height: alto }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML */}
        <Image src={mapa.foto.url} style={{ width: ancho, height: alto, objectFit: "cover" }} />
        <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} style={{ position: "absolute", top: 0, left: 0 }}>
          {mapa.lotes.map((l) => (
            <Polygon
              key={l.id}
              points={puntos(l.dibujo)}
              fill={colorCultivo(l.cultivo)}
              fillOpacity={apagado(l.id) ? 0.15 : 0.45}
              stroke={resaltado === l.id ? COLOR.sol : "white"}
              strokeWidth={resaltado === l.id ? 2.5 : 1.2}
            />
          ))}
          {zonas.map((z, i) => (
            <Polygon
              key={`z${i}`}
              points={puntos(z)}
              fill="#e11d48"
              fillOpacity={0.35}
              stroke="#e11d48"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          ))}
        </Svg>
        {mapa.lotes.map((l) => {
          const [x, y] = centro(l.dibujo);
          return (
            // Etiqueta blanca como en la app: se lee sobre cualquier foto.
            <View
              key={l.id}
              style={{ position: "absolute", left: x * ancho - 40, top: y * alto - 10, width: 80, alignItems: "center" }}
            >
              <View
                style={{
                  backgroundColor: resaltado === l.id ? COLOR.marino : "white",
                  borderRadius: 2,
                  paddingHorizontal: 3,
                  paddingVertical: 1.5,
                  opacity: apagado(l.id) ? 0.75 : 0.92,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    color: resaltado === l.id ? "white" : COLOR.texto,
                  }}
                >
                  {`${l.codigo || l.nombre}\n${nombreCultivo(l.cultivo)}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
        {cultivos.map((c) => (
          <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 8, height: 8, backgroundColor: colorCultivo(c) }} />
            <Text style={estilos.subtitulo}>{c}</Text>
          </View>
        ))}
        {elegido && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 8, height: 8, borderWidth: 1.5, borderColor: COLOR.sol }} />
            <Text style={estilos.subtitulo}>Lote {elegido.codigo || elegido.nombre}</Text>
          </View>
        )}
        {zonas.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 8, height: 8, backgroundColor: "#e11d48", opacity: 0.6 }} />
            <Text style={estilos.subtitulo}>Manchones aplicados</Text>
          </View>
        )}
      </View>
    </View>
  );
}
