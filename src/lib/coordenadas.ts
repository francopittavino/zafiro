/**
 * Coordenadas en grados, minutos y segundos, como las usa el cliente: 59°15'19.07"O.
 * En la base se guardan en grados decimales (negativas al sur y al oeste).
 */

export type Eje = "lat" | "lon";

/** -59.255297 → `59°15'19.07"O` */
export function aGms(valor: number, eje: Eje) {
  const letra = eje === "lat" ? (valor < 0 ? "S" : "N") : valor < 0 ? "O" : "E";
  // En centésimas de segundo, para que el redondeo no dé 60 segundos.
  const total = Math.round(Math.abs(valor) * 360000);
  const grados = Math.floor(total / 360000);
  const minutos = Math.floor((total % 360000) / 6000);
  const segundos = ((total % 6000) / 100).toFixed(2).padStart(5, "0");
  return `${grados}°${String(minutos).padStart(2, "0")}'${segundos}"${letra}`;
}

/** `32°28'57.14"S 59°15'19.07"O` */
export const ubicacionGms = (latitud: number, longitud: number) =>
  `${aGms(latitud, "lat")} ${aGms(longitud, "lon")}`;

/**
 * Lee una coordenada escrita en grados, minutos y segundos (59°15'19.07"O, 59 15 19,07 O)
 * o en grados decimales (-59,2553). Sin letra ni signo se toma sur/oeste (Argentina).
 * Vacía o inválida → NaN.
 */
export function leerCoordenada(texto: string, eje: Eje) {
  const t = texto.trim().toUpperCase();
  if (!t || /[^\d.,\s°º'"′″’”´`\-NSEOW]/.test(t) || /.-/.test(t)) return NaN;
  const letras = t.match(/[NSEOW]/g) ?? [];
  if (letras.length > 1) return NaN;
  const letra = letras[0];
  if (letra && !(eje === "lat" ? "NS" : "EOW").includes(letra)) return NaN;

  const numeros = (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
  if (numeros.length === 0 || numeros.length > 3) return NaN;
  const [grados, minutos = 0, segundos = 0] = numeros;
  if (minutos >= 60 || segundos >= 60) return NaN;

  const valor = grados + minutos / 60 + segundos / 3600;
  if (valor > (eje === "lat" ? 90 : 180)) return NaN;
  const norteOEste = letra === "N" || letra === "E";
  const negativo = t.startsWith("-") || (letra ? !norteOEste : true);
  return Math.round((negativo ? -valor : valor) * 1e6) / 1e6;
}

/**
 * Lee las dos coordenadas juntas, como las copia Google Maps:
 * "-32.48254, -58.23721" o `32°28'57.1"S 59°15'19.1"W`. Si no se entienden → null.
 */
export function leerPar(texto: string): [number, number] | null {
  const t = texto.trim();
  const gms = t.match(/^(.*?[NS])\s*[,;]?\s*(.+?[EOW])$/i);
  const decimal = t.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  const partes = gms ?? decimal;
  if (!partes) return null;
  const lat = leerCoordenada(partes[1], "lat");
  const lon = leerCoordenada(partes[2], "lon");
  return Number.isNaN(lat) || Number.isNaN(lon) ? null : [lat, lon];
}
