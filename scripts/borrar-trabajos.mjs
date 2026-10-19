// Borra los trabajos de prueba (la campaña vieja de la planilla) para que el ingeniero cargue todo de cero.
// Uso: npm run db:borrar-trabajos              → solo muestra qué se borraría
//      npm run db:borrar-trabajos -- --confirmar → lo borra (en una transacción: todo o nada)
//
// Se borran: órdenes de trabajo, labores (con sus productos), recetas (y sus PDF oficiales), gastos, movimientos de
// stock y los cultivos (ciclos, con su cosecha), y las campañas que quedan vacías.
// Quedan: productores, campos y lotes (con sus fotos, mapa y contornos), insumos con sus precios,
// tipos de labor, contratistas, proveedores, categorías, campos personalizados, cotizaciones y ajustes.
import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL_MIGRACIONES ?? process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL_MIGRACIONES en .env.local");
const confirmar = process.argv.includes("--confirmar");

const sql = postgres(url, { max: 1 });

// Del más dependiente al menos: así ninguna clave foránea frena el borrado.
const TABLAS = [
  ["movimientos_stock", "movimientos de stock"],
  ["orden_items", "productos de órdenes de trabajo"],
  ["orden_gastos", "gastos de órdenes de trabajo"],
  ["ordenes_trabajo", "órdenes de trabajo"],
  ["labor_insumos", "productos aplicados en labores"],
  ["labores", "labores"],
  ["receta_items", "productos de recetas"],
  ["recetas", "recetas"],
  ["gastos", "gastos"],
  ["ciclos", "cultivos (con su cosecha)"],
];

try {
  console.log(confirmar ? "Borrando los trabajos de prueba…\n" : "Prueba (no se borra nada). Se borrarían:\n");
  for (const [tabla, nombre] of TABLAS) {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(tabla)}`;
    console.log(`  ${String(n).padStart(5)}  ${nombre}`);
  }
  const fotosLabores = await sql`select count(*)::int as n from fotos where labor_id is not null`;
  console.log(`  ${String(fotosLabores[0].n).padStart(5)}  fotos de labores`);
  const pdfs = await sql`select archivo_oficial as ruta from recetas where archivo_oficial is not null`;
  console.log(`  ${String(pdfs.length).padStart(5)}  PDF de recetas oficiales`);
  const quedan = await sql`
    select (select count(*) from campos)::int as campos, (select count(*) from lotes)::int as lotes,
           (select count(*) from productos)::int as insumos`;
  console.log(`\nQuedan: ${quedan[0].campos} campos, ${quedan[0].lotes} lotes y ${quedan[0].insumos} insumos.`);

  if (!confirmar) {
    console.log("\nPara borrar de verdad: npm run db:borrar-trabajos -- --confirmar");
    process.exit(0);
  }

  const rutasFotos = await sql.begin(async (tx) => {
    const fotos = await tx`delete from fotos where labor_id is not null returning ruta`;
    for (const [tabla] of TABLAS) await tx`delete from ${tx(tabla)}`;
    // Las campañas sin cultivos ni gastos (ej. la 2024/25 de la planilla) también se van.
    await tx`delete from campanias c where not exists (select 1 from ciclos where campania_id = c.id)
               and not exists (select 1 from gastos where campania_id = c.id)`;
    return fotos.map((f) => f.ruta);
  });

  // Los archivos, después de la transacción (si fallan, solo queda basura en el bucket).
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && (rutasFotos.length || pdfs.length)) {
    const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY).storage;
    if (rutasFotos.length) await storage.from("fotos").remove(rutasFotos);
    if (pdfs.length) await storage.from("documentos").remove(pdfs.map((p) => p.ruta));
  }
  console.log("\nListo: se borraron los trabajos de prueba.");
} finally {
  await sql.end();
}
