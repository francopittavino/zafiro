import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { PantallaPin } from "./pantalla-pin";

export default async function Principal() {
  // Sin sesión, la página principal pide el PIN; con sesión, va al tablero.
  if (!(await obtenerSesion())) return <PantallaPin />;
  redirect("/inicio");
}
