import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sesiones } from "@/db/schema";
import { COOKIE_SESION } from "./sesion-cookie";
import { modoDemo } from "./modo-demo";

const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const sha256 = (valor: string) => createHash("sha256").update(valor).digest("hex");

/** Crea una sesión nueva y guarda el token en una cookie httpOnly. */
export async function crearSesion() {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_SESION_MS);

  await db.insert(sesiones).values({ id: sha256(token), expiraEn });
  // Limpieza oportunista de sesiones vencidas.
  await db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));

  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEn,
  });
}

/** Devuelve la sesión vigente o null. Memoizada por request. */
export const obtenerSesion = cache(async () => {
  if (modoDemo()) return { id: "demo", expiraEn: new Date(Date.now() + DURACION_SESION_MS) };

  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;

  const [sesion] = await db
    .select({ id: sesiones.id, expiraEn: sesiones.expiraEn })
    .from(sesiones)
    .where(and(eq(sesiones.id, sha256(token)), gt(sesiones.expiraEn, new Date())))
    .limit(1);

  return sesion ?? null;
});

/**
 * Exige una sesión válida; si no hay, vuelve a la página principal (pide el PIN).
 * Usarla en cada página protegida y al inicio de cada Server Action.
 */
export async function verificarSesion() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  return sesion;
}

/** Borra la sesión actual (base y cookie). */
export async function cerrarSesionActual() {
  if (modoDemo()) return;
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.id, sha256(token)));
  almacen.delete(COOKIE_SESION);
}
