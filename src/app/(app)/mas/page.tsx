import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  ChartColumn,
  ChevronRight,
  FileText,
  FlaskConical,
  LogOut,
  Receipt,
  Settings,
  Tractor,
  Users,
} from "lucide-react";
import { Encabezado } from "@/components/app/encabezado";
import { salir } from "../../acceso";

const OPCIONES = [
  { href: "/productores", texto: "Productores", detalle: "A quiénes asesorás y sus campos", icono: Users },
  { href: "/recetas", texto: "Recetas", detalle: "Resumen de la receta oficial, en PDF", icono: FileText },
  { href: "/informes", texto: "Informes", detalle: "Costos, margen bruto y PDF para el productor", icono: ChartColumn },
  { href: "/stock", texto: "Stock", detalle: "Insumos en cada campo", icono: Boxes },
  { href: "/gastos", texto: "Otros gastos", detalle: "Alquiler, flete, seguros…", icono: Receipt },
  { href: "/insumos", texto: "Insumos y precios", detalle: "Productos, unidades y precios", icono: FlaskConical },
  { href: "/labores", texto: "Labores y tarifas", detalle: "Tarifas en gasoil y tipo de cambio", icono: Tractor },
  { href: "/ajustes", texto: "Ajustes", detalle: "Datos propios, contratistas, proveedores", icono: Settings },
];

export default function Mas() {
  return (
    <>
      <Encabezado titulo="Más" />
      <div className="flex flex-col gap-4 p-4 md:max-w-xl md:p-0">
        <ul className="bg-card divide-y rounded-xl border">
          {OPCIONES.map(({ href, texto, detalle, icono: Icono }) => (
            <li key={href}>
              <Link href={href} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3.5">
                <span className="bg-zafiro-suave text-primary rounded-lg p-2">
                  <Icono className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{texto}</span>
                  <span className="text-muted-foreground block text-xs">{detalle}</span>
                </span>
                <ChevronRight className="text-muted-foreground size-5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        <form action={salir}>
          <button
            type="submit"
            className="bg-card text-destructive hover:bg-muted flex h-12 w-full items-center justify-center gap-2 rounded-xl border font-bold"
          >
            <LogOut className="size-5" aria-hidden />
            Salir
          </button>
        </form>

        <Image src="/marca/logo.png" alt="Zafiro Agronomía" width={140} height={138} className="mx-auto mt-4 opacity-90" />
      </div>
    </>
  );
}
