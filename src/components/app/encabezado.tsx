import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Encabezado de cada pantalla. En el celular queda fijo arriba; en la PC es el
 * título de la página (la marca ya está en la barra lateral).
 */
export function Encabezado({
  titulo,
  subtitulo,
  volver,
  acciones,
  marca = false,
}: {
  titulo: string;
  subtitulo?: string;
  /** Ruta del botón "volver" (solo celular). */
  volver?: string;
  acciones?: React.ReactNode;
  /** Muestra el isotipo antes del título en el celular (pantalla de inicio). */
  marca?: boolean;
}) {
  return (
    <header className="bg-card sticky top-0 z-20 flex items-center gap-2 border-b px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:pt-0 md:pb-2">
      {volver && (
        <Link
          href={volver}
          aria-label="Volver"
          className="no-imprimir hover:bg-muted -ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg md:hidden"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
      )}
      {marca && (
        <Image src="/marca/icono.png" alt="" width={34} height={34} className="md:hidden" priority />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-black tracking-tight md:text-2xl">{titulo}</h1>
        {subtitulo && <p className="text-muted-foreground truncate text-sm">{subtitulo}</p>}
      </div>
      {acciones && <div className="no-imprimir flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  );
}
