const enteros = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const dosDecimales = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const hasta = (decimales: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimales });

/** 172527.3 → "172.527" */
export const usd = (valor: number) => enteros.format(valor);
/** 2215.667 → "2.215,67" */
export const usd2 = (valor: number) => dosDecimales.format(valor);
/** Número con hasta N decimales: 0.15 → "0,15" */
export const num = (valor: number, decimales = 2) => hasta(decimales).format(valor);

/** Lee un número escrito a la argentina: "0,15", "0.15" o "1.234,5". Vacío o inválido → NaN. */
export function leerNumero(texto: string) {
  const t = texto.trim();
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

/** Número a texto editable, sin separador de miles: 1234.5 → "1234,5". */
export const numeroEditable = (valor: number) => num(valor, 4).replace(/\./g, "");

/** Fecha de hoy en formato ISO local ("2026-10-01"). */
export const hoyIso = () => new Date().toLocaleDateString("en-CA");

/** "2025-01-21" → "21/01/25" */
export function fechaCorta(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

/** "2025-01-21" → "enero 2025" */
export function mesAnio(iso: string) {
  const [a, m] = iso.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export const NOMBRE_CATEGORIA: Record<string, string> = {
  herbicida: "Herbicida",
  insecticida: "Insecticida",
  fungicida: "Fungicida",
  fertilizante: "Fertilizante",
  semilla: "Semilla",
  coadyuvante: "Coadyuvante",
  otro: "Otro",
  fertilizante_foliar: "Fert. foliar",
  inoculante: "Inoculante",
  curasemilla: "Curasemilla",
};
