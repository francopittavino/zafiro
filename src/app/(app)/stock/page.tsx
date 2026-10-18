import Link from "next/link";
import { Encabezado } from "@/components/app/encabezado";
import { movimientosDeCampo, obtenerDatos } from "@/lib/datos";
import { NOMBRE_CATEGORIA, num, usd } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { BotonesStock, FilaMovimiento } from "./formularios";

/** /stock?campo=ID: existencias de cada insumo en el campo elegido (por defecto, el primero con stock). */
export default async function Stock({ searchParams }: PageProps<"/stock">) {
  const { campo: elegido } = await searchParams;
  const datos = await obtenerDatos();
  const stock = datos.stock ?? [];
  const conStock = datos.campos.filter((c) => stock.some((s) => s.campoId === c.id && s.cantidad !== 0));
  const campo =
    datos.campos.find((c) => c.id === Number(elegido)) ?? conStock[0] ?? datos.campos[0];
  const movimientos = campo ? await movimientosDeCampo(campo.id, 60) : [];

  const existencias = campo
    ? stock
        .filter((s) => s.campoId === campo.id && Math.abs(s.cantidad) > 1e-9)
        .map((s) => ({ ...s, producto: datos.productos.find((p) => p.id === s.productoId) }))
        .filter((s) => s.producto)
        .sort((a, b) => a.producto!.nombre.localeCompare(b.producto!.nombre))
    : [];
  const valor = existencias.reduce((t, s) => t + Math.max(s.cantidad, 0) * s.producto!.precio, 0);
  const opciones = { campos: datos.campos, productos: datos.productos, proveedores: datos.proveedores ?? [] };

  return (
    <>
      <Encabezado
        volver="/mas"
        titulo="Stock"
        subtitulo={campo ? `${campo.nombre} · valor aprox. USD ${usd(valor)}` : "Sin campos"}
        acciones={<BotonesStock {...opciones} campoId={campo?.id} />}
      />
      <div className="flex flex-col gap-4 p-4 md:p-0">
        <nav aria-label="Campo" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {datos.campos.map((c) => (
            <Link
              key={c.id}
              href={`/stock?campo=${c.id}`}
              aria-current={c.id === campo?.id ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-bold",
                c.id === campo?.id ? "bg-primary text-primary-foreground border-primary" : "bg-card",
              )}
            >
              {c.nombre}
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section>
            <h2 className="mb-2 font-bold">Existencias</h2>
            {existencias.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                No hay stock cargado en este campo. Cargá un ingreso con &quot;+ Ingreso&quot;; al registrar labores los
                productos se descuentan solos.
              </p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border">
                {existencias.map((s) => (
                  <li key={s.productoId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block font-bold">{s.producto!.nombre}</span>
                      <span className="text-muted-foreground block text-xs">{NOMBRE_CATEGORIA[s.producto!.categoria]}</span>
                    </span>
                    <span className={cn("font-bold tabular-nums", s.cantidad < 0 && "text-destructive")}>
                      {num(s.cantidad)} {s.producto!.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {existencias.some((s) => s.cantidad < 0) && (
              <p className="text-muted-foreground mt-2 text-xs">
                En rojo: se aplicó más de lo que había cargado. Cargá el ingreso que falta o hacé un ajuste.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-bold">Últimos movimientos</h2>
            {movimientos.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">Sin movimientos.</p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border">
                {movimientos.map((m) => (
                  <FilaMovimiento
                    key={m.id}
                    movimiento={m}
                    producto={datos.productos.find((p) => p.id === m.productoId)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
