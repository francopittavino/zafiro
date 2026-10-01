import { verificarSesion } from "@/lib/sesion";
import { modoDemo } from "@/lib/modo-demo";
import { BarraInferior, BarraLateral } from "@/components/app/navegacion";
import { salir } from "../acceso";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  await verificarSesion();

  return (
    <div className="flex min-h-dvh flex-1">
      <BarraLateral salir={salir} />
      <div className="flex min-w-0 flex-1 flex-col">
        {modoDemo() && (
          <p className="no-imprimir bg-sol text-primary px-4 py-1.5 text-center text-xs font-bold">
            Modo demo · datos de la planilla del cliente · no se guarda nada
          </p>
        )}
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-24 md:px-8 md:py-8 md:pb-10">
          {children}
        </div>
      </div>
      <BarraInferior />
    </div>
  );
}
