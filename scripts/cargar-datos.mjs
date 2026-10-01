// Carga en la base los datos de la planilla del cliente (datos-demo/zafiro.json).
// Uso: npm run db:cargar   (antes: python scripts/importar-planilla.py "Anterior excel zafiro.xlsm")
//
// Solo corre con la base vacía (sin campos) para no duplicar nada. Todo va en una transacción.
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL_MIGRACIONES ?? process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL_MIGRACIONES en .env.local");

const datos = JSON.parse(await readFile("datos-demo/zafiro.json", "utf-8"));
const sql = postgres(url, { max: 1 });

// La planilla no tiene fecha de precios ni de cotización: se usa la última labor cargada.
const FECHA_PLANILLA = datos.labores.map((l) => l.fecha).sort().at(-1);

try {
  const [{ cantidad }] = await sql`select count(*)::int as cantidad from campos`;
  if (cantidad > 0) {
    console.error(`La base ya tiene ${cantidad} campos: no se carga nada para no duplicar.`);
    process.exit(1);
  }

  await sql.begin(async (tx) => {
    const [campania] = await tx`
      insert into campanias (nombre, fecha_inicio, fecha_fin)
      values (${datos.campania}, '2024-05-01', '2025-04-30') returning id`;

    const campoId = new Map();
    for (const c of datos.campos) {
      const [fila] = await tx`insert into campos (nombre) values (${c.nombre}) returning id`;
      campoId.set(c.id, fila.id);
    }

    // Un ciclo por lote en la campaña, con el cultivo de la planilla ("Trigo/Soja" queda como doble cultivo).
    const cicloDeLote = new Map();
    for (const l of datos.lotes) {
      const [lote] = await tx`
        insert into lotes (campo_id, codigo, nombre, superficie_ha)
        values (${campoId.get(l.campoId)}, ${l.codigo}, ${l.nombre}, ${l.ha}) returning id`;
      const cosecha = datos.cosechas.find((c) => c.loteId === l.id);
      const [ciclo] = await tx`
        insert into ciclos (lote_id, campania_id, cultivo, superficie_ha, fecha_cosecha, rinde_kg_ha,
          precio_pizarra, arrendamiento_porcentaje, gastos_comercializacion_porcentaje, flete_usd_tn)
        values (${lote.id}, ${campania.id}, ${l.cultivo}, ${l.ha}, ${cosecha?.fecha ?? null},
          ${cosecha?.rindeKgHa ?? null}, ${cosecha?.precioPizarra ?? null},
          ${cosecha?.arrendamientoPorcentaje ?? null}, ${cosecha?.gastosComercializacionPorcentaje ?? null},
          ${cosecha?.fleteUsdTn ?? null})
        returning id`;
      cicloDeLote.set(l.id, ciclo.id);
    }

    const productoId = new Map();
    for (const p of datos.productos) {
      const [fila] = await tx`
        insert into productos (nombre_comercial, categoria, unidad)
        values (${p.nombre}, ${p.categoria}, ${p.unidad}) returning id`;
      productoId.set(p.id, fila.id);
      await tx`
        insert into precios_producto (producto_id, moneda, precio_unitario, fecha)
        values (${fila.id}, 'USD', ${p.precio}, ${FECHA_PLANILLA})`;
    }

    const tipoId = new Map();
    for (const t of datos.tiposLabor) {
      const [fila] = await tx`
        insert into tipos_labor (nombre, categoria, cotizacion, litros_gasoil_ha, costo_usd_ha)
        values (${t.nombre}, ${t.categoria}, ${t.cotizacion}, ${t.litrosGasoilHa}, ${t.costoUsdHa}) returning id`;
      tipoId.set(t.id, fila.id);
    }
    // Filas de la planilla con productos pero sin labor indicada.
    const [sinLabor] = await tx`
      insert into tipos_labor (nombre, categoria, cotizacion, costo_usd_ha)
      values ('Aplicación de insumos', 'otra', 'usd_fijo', 0) returning id`;

    const aporteId = new Map();
    for (const nombre of datos.aportes) {
      const [fila] = await tx`insert into aportes (nombre) values (${nombre}) returning id`;
      aporteId.set(nombre, fila.id);
    }

    await tx`
      insert into cotizaciones (fecha, tipo_cambio, precio_gasoil)
      values (${FECHA_PLANILLA}, ${datos.cotizacion.tipoCambio}, ${datos.cotizacion.precioGasoil})`;
    await tx`
      insert into configuracion (clave, valor)
      values ('gastos_comercializacion_porcentaje', '0.05'), ('flete_usd_tn', '27')`;

    for (const l of datos.labores) {
      const [labor] = await tx`
        insert into labores (ciclo_id, tipo_labor_id, fecha, superficie_ha, aporte_id,
          costo_labor_por_ha, moneda_labor, tipo_cambio, notas)
        values (${cicloDeLote.get(l.loteId)}, ${l.tipoLaborId ? tipoId.get(l.tipoLaborId) : sinLabor.id},
          ${l.fecha}, ${l.ha}, ${l.aporte ? aporteId.get(l.aporte) : null}, ${l.costoLaborHa}, 'USD',
          ${datos.cotizacion.tipoCambio}, 'Importada de la planilla anterior')
        returning id`;
      for (const i of l.insumos) {
        await tx`
          insert into labor_insumos (labor_id, producto_id, dosis_por_ha, cantidad_total, precio_unitario, moneda)
          values (${labor.id}, ${productoId.get(i.productoId)}, ${i.dosis}, ${i.dosis * l.ha}, ${i.precio}, 'USD')`;
      }
    }
  });

  console.log(
    `Listo: ${datos.campos.length} campos, ${datos.lotes.length} lotes, ${datos.productos.length} productos, ` +
      `${datos.tiposLabor.length + 1} tipos de labor, ${datos.labores.length} labores.`,
  );
} finally {
  await sql.end();
}
