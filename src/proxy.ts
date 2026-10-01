import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/sesion-cookie";

/**
 * Chequeo optimista: sin cookie de sesión, cualquier ruta que no sea la
 * principal vuelve a "/" (ahí se pide el PIN). La validación real contra la
 * base la hace `verificarSesion()` en cada página y Server Action.
 */
export function proxy(request: NextRequest) {
  const tieneCookie = request.cookies.has(COOKIE_SESION);

  if (!tieneCookie && request.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo excepto archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
