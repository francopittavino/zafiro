"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { intentosAcceso } from "@/db/schema";
import { cerrarSesionActual, crearSesion, sha256 } from "@/lib/sesion";

const MAX_FALLOS = 5;
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

export type EstadoPin = { error?: string } | undefined;

export async function ingresarConPin(_estado: EstadoPin, formData: FormData): Promise<EstadoPin> {
  const pinCorrecto = process.env.ACCESO_PIN;
  if (!pinCorrecto) return { error: "El acceso no está configurado (falta ACCESO_PIN)." };

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  const desde = new Date(Date.now() - VENTANA_BLOQUEO_MS);

  const [{ fallos }] = await db
    .select({ fallos: count() })
    .from(intentosAcceso)
    .where(
      and(
        eq(intentosAcceso.ip, ip),
        eq(intentosAcceso.exitoso, false),
        gt(intentosAcceso.creadoEn, desde),
      ),
    );

  if (fallos >= MAX_FALLOS) {
    return { error: "Demasiados intentos. Probá de nuevo en 15 minutos." };
  }

  const pin = String(formData.get("pin") ?? "").trim();
  // Comparación en tiempo constante (sobre los hashes, que tienen igual largo).
  const valido = timingSafeEqual(Buffer.from(sha256(pin)), Buffer.from(sha256(pinCorrecto)));

  await db.insert(intentosAcceso).values({ ip, exitoso: valido });

  if (!valido) {
    const restantes = MAX_FALLOS - fallos - 1;
    return {
      error:
        restantes > 0
          ? `PIN incorrecto. Te quedan ${restantes} ${restantes === 1 ? "intento" : "intentos"}.`
          : "PIN incorrecto. Acceso bloqueado por 15 minutos.",
    };
  }

  // Limpieza oportunista del historial de intentos (más de 1 día).
  await db
    .delete(intentosAcceso)
    .where(lt(intentosAcceso.creadoEn, new Date(Date.now() - 24 * 60 * 60 * 1000)));

  await crearSesion();
  redirect("/");
}

export async function salir() {
  await cerrarSesionActual();
  redirect("/");
}
