---
name: close-session
description: Cierra una sesión de trabajo en Zafiro. Actualiza docs/DECISIONES.md con lo decidido y hecho, verifica que el proyecto compile, commitea y hace git push al repo. Usar al terminar de trabajar.
disable-model-invocation: true
---

# Cerrar sesión

Seguí estos pasos en orden y al final mostrá un resumen corto en español.

## 1. Actualizar `docs/DECISIONES.md`

Revisá la conversación de esta sesión y los cambios (`git status`, `git diff --stat`) y actualizá el documento:
- **Tabla de decisiones:** agregá una fila con la fecha de hoy por cada decisión nueva, incluido el motivo.
- **Preguntas abiertas:** sacá las que se resolvieron y agregá las nuevas.
- **Bitácora de sesiones:** agregá una entrada con la fecha, qué se hizo (en viñetas cortas) y los próximos pasos.
- Si cambió el modelo de datos, la estructura o los documentos del proyecto, actualizá esas secciones.

No inventes decisiones: registrá solo lo que realmente se habló o se hizo.

## 2. Verificar

- `npx tsc --noEmit` y `npm run lint`.
- Si fallan, mostrale los errores al usuario y **preguntale** si commitea igual o lo arregla primero.

## 3. Commit

- `git status --short`. Revisá que no se suban secretos: `.env.local` y cualquier `.env` con credenciales están en `.gitignore` y no se tienen que commitear nunca.
- `git add -A`.
- Escribí un mensaje de commit en español: un título corto y viñetas con lo principal de la sesión.
- Si no hay cambios, salteá el commit.

## 4. Push

- `git pull --rebase` (por si hubo cambios desde otra PC) y después `git push`.
- Si hay conflictos o falla la autenticación, **no fuerces** (nunca `--force`): mostrá el error y proponé cómo resolverlo.

## 5. Resumen

Mostrá el commit creado (hash y título), si el push salió bien, y los próximos pasos que quedaron anotados en la bitácora.
