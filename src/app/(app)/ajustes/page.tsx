import { Encabezado } from "@/components/app/encabezado";
import { obtenerDatos, type EntidadPersonalizable } from "@/lib/datos";
import { EditorCamposPersonalizados, EditorLista } from "./editores";

const ENTIDADES: { entidad: EntidadPersonalizable; titulo: string; ayuda: string }[] = [
  { entidad: "campo", titulo: "Campos", ayuda: "Ej. Dueño del campo, Acceso" },
  { entidad: "lote", titulo: "Lotes", ayuda: "Ej. Napa, Antecesor, Ambiente" },
  { entidad: "producto", titulo: "Insumos", ayuda: "Ej. N° de registro SENASA, Clase" },
  { entidad: "labor", titulo: "Labores y aplicaciones", ayuda: "Ej. Pastilla, Presión, Velocidad" },
  { entidad: "receta", titulo: "Recetas", ayuda: "Ej. Estado del cultivo, Adyuvante sugerido" },
];

export default async function Ajustes() {
  const datos = await obtenerDatos();
  const personalizados = datos.camposPersonalizados ?? [];

  return (
    <>
      <Encabezado volver="/mas" titulo="Ajustes" subtitulo="Datos propios y listas que usás al cargar" />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:items-start md:p-0">
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4">
          <div>
            <h2 className="font-bold">Datos propios</h2>
            <p className="text-muted-foreground text-sm">
              Agregá los datos que quieras anotar además de los que ya trae el sistema. Aparecen en el formulario
              (en &quot;Más datos&quot;) y en los PDF. Todos son opcionales; si quitás uno, lo ya cargado no se borra.
            </p>
          </div>
          {ENTIDADES.map((e) => (
            <div key={e.entidad} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">
                {e.titulo} <span className="text-muted-foreground font-normal">· {e.ayuda}</span>
              </h3>
              <EditorCamposPersonalizados entidad={e.entidad} campos={personalizados} />
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-4">
          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">Categorías de gastos</h2>
            <p className="text-muted-foreground text-sm">Para los otros gastos: alquiler, flete, seguros…</p>
            <EditorLista lista="categoriasGasto" elementos={datos.categoriasGasto ?? []} placeholder="Nueva categoría" />
          </section>
          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">Contratistas</h2>
            <EditorLista lista="contratistas" elementos={datos.contratistas ?? []} placeholder="Nuevo contratista" />
          </section>
          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">Proveedores</h2>
            <EditorLista lista="proveedores" elementos={datos.proveedores ?? []} placeholder="Nuevo proveedor" />
          </section>
          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">Aportes</h2>
            <p className="text-muted-foreground text-sm">Quién aporta o paga (columna APORTE de la planilla).</p>
            <EditorLista lista="aportes" elementos={datos.listaAportes ?? []} placeholder="Nuevo aporte" />
          </section>
        </div>
      </div>
    </>
  );
}
