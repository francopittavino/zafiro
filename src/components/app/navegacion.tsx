"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  Ellipsis,
  FlaskConical,
  House,
  List,
  LogOut,
  Map,
  Plus,
  Tractor,
} from "lucide-react";
import { cn } from "@/lib/utils";

const activo = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

/** En el celular, "Más" agrupa insumos, labores e informes. */
const RUTAS_DE_MAS = ["/mas", "/insumos", "/labores", "/informes"];

const SECCIONES_PC = [
  { href: "/inicio", texto: "Inicio", icono: House },
  { href: "/lotes", texto: "Campos y lotes", icono: Map },
  { href: "/historial", texto: "Historial", icono: List },
  { href: "/insumos", texto: "Insumos y precios", icono: FlaskConical },
  { href: "/labores", texto: "Labores y tarifas", icono: Tractor },
  { href: "/informes", texto: "Informes", icono: ChartColumn },
];

export function BarraLateral({ salir }: { salir: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 md:flex">
      <Link href="/inicio" className="mb-6 flex items-center gap-2.5 px-2">
        <Image src="/marca/icono.png" alt="" width={36} height={36} priority />
        <span className="leading-tight">
          <span className="text-primary block text-lg font-black tracking-tight">Zafiro</span>
          <span className="text-muted-foreground block text-[11px] tracking-[0.2em]">AGRONOMÍA</span>
        </span>
      </Link>

      <Link
        href="/registrar"
        className="bg-primary text-primary-foreground hover:bg-primary/90 mb-4 flex h-11 items-center justify-center gap-2 rounded-lg font-bold"
      >
        <Plus className="size-5" aria-hidden />
        Registrar labor
      </Link>

      <nav aria-label="Secciones" className="flex flex-col gap-0.5">
        {SECCIONES_PC.map(({ href, texto, icono: Icono }) => (
          <Link
            key={href}
            href={href}
            aria-current={activo(pathname, href) ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
              activo(pathname, href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icono className="size-[18px]" aria-hidden />
            {texto}
          </Link>
        ))}
      </nav>

      <form action={salir} className="mt-auto">
        <button
          type="submit"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm"
        >
          <LogOut className="size-[18px]" aria-hidden />
          Salir
        </button>
      </form>
    </aside>
  );
}

const SECCIONES_CELULAR = [
  { href: "/inicio", texto: "Inicio", icono: House },
  { href: "/lotes", texto: "Lotes", icono: Map },
  { href: "/registrar", texto: "Registrar", icono: Plus },
  { href: "/historial", texto: "Historial", icono: List },
  { href: "/mas", texto: "Más", icono: Ellipsis },
];

export function BarraInferior() {
  const pathname = usePathname();
  // El formulario de carga tiene su propia barra de acciones abajo.
  if (pathname === "/registrar") return null;

  return (
    <nav
      aria-label="Principal"
      className="bg-card fixed inset-x-0 bottom-0 z-30 grid h-[68px] grid-cols-5 items-center border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECCIONES_CELULAR.map(({ href, texto, icono: Icono }) => {
        const esActivo =
          href === "/mas"
            ? RUTAS_DE_MAS.some((r) => activo(pathname, r))
            : activo(pathname, href);

        if (href === "/registrar") {
          return (
            <Link
              key={href}
              href={href}
              aria-label="Registrar labor"
              className="bg-primary text-primary-foreground justify-self-center rounded-full p-3.5 shadow-md"
            >
              <Icono className="size-6" aria-hidden />
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            aria-current={esActivo ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[11px]",
              esActivo ? "text-zafiro font-bold" : "text-muted-foreground",
            )}
          >
            <Icono className="size-[22px]" aria-hidden />
            {texto}
          </Link>
        );
      })}
    </nav>
  );
}
