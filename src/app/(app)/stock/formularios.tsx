"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Campo, Catalogo, Movimiento, Producto } from "@/lib/datos";
import { BotonAlta, Pie, entrada, etiqueta, useEnvio } from "@/components/app/altas";
import { NOMBRE_CATEGORIA, fechaCorta, hoyIso, leerNumero, num } from "@/lib/formato";
import { eliminarMovimiento, registrarMovimiento } from "./acciones";

function FormMovimiento({
  tipo,
  campos,
  productos,
  proveedores,
  campoId,
  productoId,
  alGuardar,
}: {
  tipo: "ingreso" | "ajuste";
  campos: Campo[];
  productos: Producto[];
  proveedores: Catalogo[];
  campoId?: number;
  productoId?: number;
  alGuardar: (id?: number) => void;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const cantidad = leerNumero(String(f.get("cantidad")));
        if (Number.isNaN(cantidad)) return setError("Escribí una cantidad válida.");
        const proveedor = String(f.get("proveedorId") ?? "");
        enviar(() =>
          registrarMovimiento({
            tipo,
            campoId: Number(f.get("campoId")),
            productoId: Number(f.get("productoId")),
            fecha: String(f.get("fecha")),
            cantidad,
            proveedorId: proveedor ? Number(proveedor) : null,
            nota: String(f.get("nota") ?? ""),
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Campo *
        <select name="campoId" className={entrada} defaultValue={campoId ?? ""} required>
          <option value="" disabled>
            Elegí…
          </option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Insumo *
        <select name="productoId" className={entrada} defaultValue={productoId ?? ""} required>
          <option value="" disabled>
            Elegí…
          </option>
          {Object.entries(NOMBRE_CATEGORIA).map(([categoria, nombre]) => {
            const lista = productos.filter((p) => p.categoria === categoria);
            if (!lista.length) return null;
            return (
              <optgroup key={categoria} label={nombre}>
                {lista.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.unidad})
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          {tipo === "ingreso" ? "Cantidad que entra *" : "Cantidad real contada *"}
          <input name="cantidad" className={entrada} inputMode="decimal" required autoFocus />
        </label>
        <label className={etiqueta}>
          Fecha *
          <input name="fecha" type="date" className={entrada} defaultValue={hoyIso()} required />
        </label>
      </div>
      {tipo === "ingreso" && (
        <label className={etiqueta}>
          Proveedor
          <select name="proveedorId" className={entrada} defaultValue="">
            <option value="">Sin dato</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={etiqueta}>
        Nota
        <input name="nota" className={entrada} placeholder={tipo === "ingreso" ? "Ej. Remito 0001-1234" : "Ej. Recuento de fin de campaña"} />
      </label>
      {tipo === "ajuste" && (
        <p className="text-muted-foreground text-xs">Se guarda la diferencia con el stock que figura en el sistema.</p>
      )}
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

type Opciones = { campos: Campo[]; productos: Producto[]; proveedores: Catalogo[]; campoId?: number };

export function BotonesStock(props: Opciones) {
  return (
    <>
      <BotonAlta
        texto="Ajuste"
        titulo="Ajustar stock (recuento)"
        variante="secundario"
        formulario={(listo) => <FormMovimiento tipo="ajuste" {...props} alGuardar={listo} />}
      />
      <BotonAlta
        texto="+ Ingreso"
        titulo="Ingreso de insumos"
        formulario={(listo) => <FormMovimiento tipo="ingreso" {...props} alGuardar={listo} />}
      />
    </>
  );
}

const TEXTO_TIPO = { ingreso: "Ingreso", aplicacion: "Aplicación", ajuste: "Ajuste" };

export function FilaMovimiento({ movimiento, producto }: { movimiento: Movimiento; producto?: Producto }) {
  const [borrando, iniciar] = useTransition();
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground w-14 shrink-0 text-xs">{fechaCorta(movimiento.fecha)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{producto?.nombre ?? "Insumo"}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {TEXTO_TIPO[movimiento.tipo]}
          {movimiento.proveedor && ` · ${movimiento.proveedor}`}
          {movimiento.nota && ` · ${movimiento.nota}`}
          {movimiento.laborId && (
            <>
              {" · "}
              <Link href={`/registrar?labor=${movimiento.laborId}`} className="text-zafiro font-bold">
                ver labor
              </Link>
            </>
          )}
        </span>
      </span>
      <span className={`font-bold tabular-nums ${movimiento.cantidad < 0 ? "text-destructive" : "text-positivo"}`}>
        {movimiento.cantidad > 0 && "+"}
        {num(movimiento.cantidad)} {producto?.unidad}
      </span>
      {movimiento.laborId === null ? (
        <button
          type="button"
          disabled={borrando}
          onClick={() => iniciar(async () => void (await eliminarMovimiento(movimiento.id)))}
          aria-label="Eliminar movimiento"
          className="text-muted-foreground hover:bg-muted hover:text-destructive flex size-9 items-center justify-center rounded-lg"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="size-9" aria-hidden />
      )}
    </li>
  );
}
