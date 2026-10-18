import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, FileDown } from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { ChipCultivo } from "@/components/app/chip-cultivo";
import { GaleriaFotos } from "@/components/app/galeria-fotos";
import { BotonEditarCampo } from "@/components/app/altas";
import { valoresExtra } from "@/components/app/campos-extra";
import { obtenerDatos } from "@/lib/datos";
import { costosPorLote } from "@/lib/consultas";
import { fotosDe, mapasDeCampos } from "@/lib/fotos";
import { MapaCampo } from "@/components/app/mapa";
import { usd } from "@/lib/formato";
import { BotonNuevoGasto } from "../../gastos/formulario-gasto";

export default async function FichaCampo({ params }: PageProps<"/campos/[id]">) {
  const { id } = await params;
  const datos = await obtenerDatos();
  const campo = datos.campos.find((c) => c.id === Number(id));
  if (!campo) notFound();

  const productor = datos.productores?.find((p) => p.id === campo.productorId);
  const filas = (await costosPorLote()).filter((f) => f.campoId === campo.id);
  const ha = filas.reduce((t, f) => t + f.lote.ha, 0);
  const total = filas.reduce((t, f) => t + f.costos.total, 0);
  const [galeria, mapas] = await Promise.all([fotosDe({ tipo: "campo", id: campo.id }), mapasDeCampos([campo])]);
  const personalizados = datos.camposPersonalizados ?? [];
  const gastosDelCampo = (datos.gastos ?? []).filter((g) => g.campoId === campo.id);
  const conStock = (datos.stock ?? []).filter((s) => s.campoId === campo.id && s.cantidad !== 0).length;
  const ficha = [
    { nombre: "Productor", valor: productor?.nombre },
    { nombre: "Localidad", valor: [campo.localidad, campo.provincia].filter(Boolean).join(", ") },
    ...valoresExtra(personalizados.filter((c) => c.entidad === "campo"), campo.extras),
  ].filter((d) => d.valor);
  const mapa =
    campo.latitud != null && campo.longitud != null
      ? `https://www.google.com/maps?q=${campo.latitud},${campo.longitud}`
      : null;

  return (
    <>
      <Encabezado
        volver={productor ? `/productores/${productor.id}` : "/lotes"}
        titulo={campo.nombre}
        subtitulo={`${filas.length} ${filas.length === 1 ? "lote" : "lotes"} · ${usd(ha)} ha · USD ${usd(total)} en la campaña`}
        acciones={
          <BotonEditarCampo campo={campo} productores={datos.productores} personalizados={personalizados} />
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:items-start md:p-0">
        {/* En el celular el mapa va primero: es lo que se mira al entrar al campo. */}
        <div className="flex flex-col gap-4 md:order-2">
          <MapaCampo
            campoId={campo.id}
            foto={mapas.get(campo.id) ?? null}
            fotos={galeria.fotos}
            lotes={filas.map(({ lote: l }) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, cultivo: l.cultivo, dibujo: l.dibujo }))}
            disponible={galeria.disponible}
          />
        </div>
        <div className="flex flex-col gap-4 md:order-1">
          {(ficha.length > 0 || mapa || campo.notas) && (
            <section className="bg-card rounded-xl border p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {ficha.map((d) => (
                  <div key={d.nombre}>
                    <dt className="text-muted-foreground text-xs">{d.nombre}</dt>
                    <dd className="font-bold">{d.valor}</dd>
                  </div>
                ))}
              </dl>
              {mapa && (
                <a href={mapa} target="_blank" rel="noreferrer" className="text-zafiro mt-2 block font-bold">
                  Ver ubicación en el mapa →
                </a>
              )}
              {campo.notas && <p className="text-muted-foreground mt-2 whitespace-pre-line">{campo.notas}</p>}
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/stock?campo=${campo.id}`}
              className="bg-card hover:bg-muted flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold"
            >
              <Boxes className="size-5" aria-hidden />
              Stock ({conStock})
            </Link>
            <a
              href={`/informes/pdf?campo=${campo.id}`}
              className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
            >
              <FileDown className="size-5" aria-hidden />
              Informe PDF
            </a>
          </div>

          <section>
            <h2 className="mb-2 font-bold">Lotes</h2>
            <ul className="bg-card divide-y rounded-xl border">
              {filas.map(({ lote: l, costos }) => (
                <li key={l.id}>
                  <Link
                    href={`/lotes/${l.id}`}
                    className="hover:bg-muted/60 grid grid-cols-[56px_1fr_auto] items-center gap-2 px-4 py-3"
                  >
                    <span className="text-zafiro text-xs font-black">{l.codigo}</span>
                    <span>
                      <span className="block font-bold">{l.nombre}</span>
                      <span className="text-muted-foreground block text-xs">
                        {usd(l.ha)} ha · USD {usd(costos.total)}
                      </span>
                    </span>
                    <ChipCultivo cultivo={l.cultivo} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Gastos del campo</h2>
              <BotonNuevoGasto
                campos={datos.campos}
                lotes={datos.lotes}
                categorias={datos.categoriasGasto ?? []}
                inicial={{ campoId: campo.id }}
              />
            </div>
            {gastosDelCampo.length === 0 ? (
              <p className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">
                Gastos de todo el campo (ej. alquiler): se reparten entre los lotes por hectárea.
              </p>
            ) : (
              <ul className="bg-card divide-y rounded-xl border text-sm">
                {gastosDelCampo.map((g) => (
                  <li key={g.id} className="flex justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block font-bold">{g.categoria}</span>
                      {g.descripcion && <span className="text-muted-foreground block text-xs">{g.descripcion}</span>}
                    </span>
                    <span className="font-bold tabular-nums">{usd(g.importe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <GaleriaFotos destino={{ tipo: "campo", id: campo.id }} {...galeria} />
        </div>
      </div>
    </>
  );
}
