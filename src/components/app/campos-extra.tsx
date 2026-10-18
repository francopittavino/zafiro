import type { CampoPersonalizado } from "@/lib/datos";
import type { Extras } from "@/db/schema";
import { fechaCorta } from "@/lib/formato";

/**
 * Campos personalizados de un formulario (se agregan en Ajustes). Los inputs se llaman
 * `extra_<id>`; `leerExtras` los junta al enviar.
 */
export function CamposExtra({
  campos,
  valores,
  etiqueta,
  entrada,
}: {
  campos: CampoPersonalizado[];
  valores?: Extras | null;
  etiqueta: string;
  entrada: string;
}) {
  if (!campos.length) return null;
  return (
    <>
      {campos.map((c) => (
        <label key={c.id} className={etiqueta}>
          {c.nombre}
          <input
            name={`extra_${c.id}`}
            type={c.tipo === "fecha" ? "date" : "text"}
            inputMode={c.tipo === "numero" ? "decimal" : undefined}
            defaultValue={valores?.[String(c.id)] ?? ""}
            className={entrada}
          />
        </label>
      ))}
    </>
  );
}

export function leerExtras(f: FormData): Extras {
  const extras: Extras = {};
  for (const [clave, valor] of f.entries()) {
    if (clave.startsWith("extra_") && typeof valor === "string" && valor.trim()) extras[clave.slice(6)] = valor.trim();
  }
  return extras;
}

/** Lista "nombre: valor" para mostrar los campos personalizados cargados. */
export function valoresExtra(campos: CampoPersonalizado[], valores?: Extras | null) {
  if (!valores) return [];
  return campos
    .filter((c) => valores[String(c.id)])
    .map((c) => {
      const valor = valores[String(c.id)];
      return { nombre: c.nombre, valor: c.tipo === "fecha" ? fechaCorta(valor) : valor };
    });
}
