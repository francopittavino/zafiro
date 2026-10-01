import type { Cosecha, Datos, Labor, TipoLabor } from "./datos";

/** USD/ha de un tipo de labor según la cotización (litros de gasoil × precio / tipo de cambio). */
export function tarifaUsdHa(tipo: TipoLabor, cotizacion: Datos["cotizacion"]) {
  if (tipo.cotizacion === "usd_fijo") return tipo.costoUsdHa ?? 0;
  return ((tipo.litrosGasoilHa ?? 0) * cotizacion.precioGasoil) / cotizacion.tipoCambio;
}

/** Costos de una labor: insumos (dosis × precio × ha) + labor (costo/ha × ha). */
export function costoLabor(labor: Pick<Labor, "ha" | "costoLaborHa" | "insumos">) {
  const insumos = labor.insumos.reduce((total, i) => total + i.dosis * i.precio * labor.ha, 0);
  const trabajo = labor.costoLaborHa * labor.ha;
  return { insumos, trabajo, total: insumos + trabajo };
}

/**
 * Margen bruto de un ciclo, con las mismas fórmulas que la planilla del cliente:
 * kg netos = (rinde − rinde × arrendamiento) × ha; gastos = tn netas × pizarra × %;
 * flete = tn netas × tarifa; ingreso neto = tn netas × pizarra − gastos − flete.
 */
export function margenBruto(
  ha: number,
  cosecha: Cosecha,
  costos: { insumos: number; labores: number; cosecha: number },
) {
  const tnBrutas = (cosecha.rindeKgHa * ha) / 1000;
  const tnArrendamiento = tnBrutas * (cosecha.arrendamientoPorcentaje ?? 0);
  const tnNetas = tnBrutas - tnArrendamiento;
  const ingresoBruto = tnNetas * cosecha.precioPizarra;
  const comercializacion = ingresoBruto * cosecha.gastosComercializacionPorcentaje;
  const flete = tnNetas * cosecha.fleteUsdTn;
  const ingresoNeto = ingresoBruto - comercializacion - flete;
  const costoTotal = costos.insumos + costos.labores + costos.cosecha;
  const margen = ingresoNeto - costoTotal;
  return {
    tnBrutas,
    tnArrendamiento,
    tnNetas,
    ingresoBruto,
    comercializacion,
    flete,
    ingresoNeto,
    costoTotal,
    margen,
    /** Pasa un importe total a toneladas de grano por hectárea. */
    tnHa: (usd: number) => usd / cosecha.precioPizarra / ha,
  };
}
