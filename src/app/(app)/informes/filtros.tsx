"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Campo, Lote, Productor } from "@/lib/datos";
import { entrada } from "@/components/app/altas";

/** Filtros del informe: cambian la URL, así el PDF y la pantalla muestran lo mismo. */
export function Filtros({
  productores,
  campos,
  lotes,
  cultivos,
}: {
  productores: Productor[];
  campos: Campo[];
  lotes: Lote[];
  cultivos: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const productor = sp.get("productor") ?? "";
  const campo = sp.get("campo") ?? "";

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(sp.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    // Al cambiar un filtro de arriba, los de abajo que ya no corresponden se limpian.
    if (clave === "productor") {
      nuevos.delete("campo");
      nuevos.delete("lote");
    }
    if (clave === "campo") nuevos.delete("lote");
    router.replace(`${pathname}?${nuevos.toString()}`, { scroll: false });
  }

  const camposVisibles = campos.filter((c) => !productor || String(c.productorId) === productor);
  const lotesVisibles = lotes.filter(
    (l) => (!campo || String(l.campoId) === campo) && camposVisibles.some((c) => c.id === l.campoId),
  );
  const select = `${entrada} h-10 text-sm`;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {productores.length > 0 && (
        <select aria-label="Productor" className={select} value={productor} onChange={(e) => cambiar("productor", e.target.value)}>
          <option value="">Todos los productores</option>
          {productores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Campo" className={select} value={campo} onChange={(e) => cambiar("campo", e.target.value)}>
        <option value="">Todos los campos</option>
        {camposVisibles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Lote" className={select} value={sp.get("lote") ?? ""} onChange={(e) => cambiar("lote", e.target.value)}>
        <option value="">Todos los lotes</option>
        {lotesVisibles.map((l) => (
          <option key={l.id} value={l.id}>
            {l.codigo} {l.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Cultivo" className={select} value={sp.get("cultivo") ?? ""} onChange={(e) => cambiar("cultivo", e.target.value)}>
        <option value="">Todos los cultivos</option>
        {cultivos.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        aria-label="Agrupar por"
        className={select}
        value={sp.get("agrupar") ?? "campo"}
        onChange={(e) => cambiar("agrupar", e.target.value)}
      >
        <option value="campo">Agrupar por campo</option>
        <option value="lote">Agrupar por lote</option>
        <option value="cultivo">Agrupar por cultivo</option>
        <option value="productor">Agrupar por productor</option>
      </select>
    </div>
  );
}
