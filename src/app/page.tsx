import { obtenerSesion } from "@/lib/sesion";
import { Button } from "@/components/ui/button";
import { salir } from "./acceso";
import { PantallaPin } from "./pantalla-pin";

const modulos = [
  { titulo: "Campos y lotes", detalle: "Importar lotes desde Google Earth (KML/KMZ)" },
  { titulo: "Productos", detalle: "Catálogo de agroquímicos, semillas y fertilizantes" },
  { titulo: "Lista de precios", detalle: "Precios por proveedor, en ARS o USD, con historial" },
  { titulo: "Recetas", detalle: "Generar y cargar recetas de aplicación" },
  { titulo: "Labores", detalle: "Siembra, pulverización, fertilización, cosecha" },
  { titulo: "Informes", detalle: "Costos por lote, campo, cultivo y campaña" },
];

export default async function Inicio() {
  // Sin sesión, la misma página principal pide el PIN.
  if (!(await obtenerSesion())) return <PantallaPin />;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zafiro</h1>
          <p className="text-muted-foreground text-sm">Gestión agronómica</p>
        </div>
        <form action={salir}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {modulos.map((m) => (
          <li key={m.titulo} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{m.titulo}</h2>
              <span className="text-muted-foreground text-xs">Próximamente</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{m.detalle}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
