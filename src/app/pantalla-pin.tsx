"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingresarConPin } from "./acceso";

export function PantallaPin() {
  const [estado, accion, enviando] = useActionState(ingresarConPin, undefined);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <form action={accion} className="grid w-full max-w-xs gap-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zafiro</h1>
          <p className="text-muted-foreground text-sm">Ingresá el PIN para continuar</p>
        </div>

        <Input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          aria-label="PIN"
          maxLength={12}
          autoFocus
          required
          className="h-14 text-center text-2xl tracking-[0.5em]"
        />

        {estado?.error && (
          <p role="alert" className="text-destructive text-sm">
            {estado.error}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="h-12 w-full text-base">
          {enviando ? "Verificando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
