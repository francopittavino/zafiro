/** Opciones fijas de los formularios (coinciden con los enums de src/db/schema.ts). */

export const CATEGORIAS_PRODUCTO = [
  { valor: "herbicida", texto: "Herbicida" },
  { valor: "insecticida", texto: "Insecticida" },
  { valor: "fungicida", texto: "Fungicida" },
  { valor: "coadyuvante", texto: "Coadyuvante / adherente" },
  { valor: "fertilizante", texto: "Fertilizante" },
  { valor: "fertilizante_foliar", texto: "Fertilizante foliar" },
  { valor: "semilla", texto: "Semilla" },
  { valor: "inoculante", texto: "Inoculante" },
  { valor: "curasemilla", texto: "Curasemilla" },
  { valor: "otro", texto: "Otro" },
] as const;

export const UNIDADES = [
  { valor: "L", texto: "Litros (L)" },
  { valor: "kg", texto: "Kilos (kg)" },
  { valor: "tn", texto: "Toneladas (tn)" },
  { valor: "bolsa", texto: "Bolsas" },
  { valor: "pack", texto: "Pack" },
  { valor: "dosis", texto: "Dosis" },
  { valor: "u", texto: "Unidades" },
] as const;

export const CATEGORIAS_LABOR = [
  { valor: "pulverizacion", texto: "Pulverización / aplicación" },
  { valor: "siembra", texto: "Siembra" },
  { valor: "fertilizacion", texto: "Fertilización" },
  { valor: "laboreo", texto: "Laboreo (rastra, etc.)" },
  { valor: "cosecha", texto: "Cosecha" },
  { valor: "otra", texto: "Otra" },
] as const;

/** Sugerencias para el cultivo (se puede escribir otro). */
export const CULTIVOS_SUGERIDOS = ["Soja", "Maíz", "Trigo", "Girasol", "Sorgo", "Cebada", "Trigo/Soja"];
