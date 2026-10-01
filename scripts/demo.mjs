// Levanta `next dev` en modo demo (sin base ni PIN, con datos-demo/zafiro.json).
// Ver src/lib/modo-demo.ts.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("datos-demo/zafiro.json")) {
  console.warn(
    'Aviso: falta datos-demo/zafiro.json. Generalo con: python scripts/importar-planilla.py "Anterior excel zafiro.xlsm"',
  );
}

spawn("npx next dev", { stdio: "inherit", shell: true, env: { ...process.env, ZAFIRO_DEMO: "1" } }).on(
  "exit",
  (codigo) => process.exit(codigo ?? 0),
);
