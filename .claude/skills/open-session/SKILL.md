---
name: open-session
description: Abre una sesión de trabajo en Zafiro. Hace git pull del repo, instala dependencias si cambiaron y pone en contexto leyendo docs/DECISIONES.md. Usar al empezar a trabajar.
disable-model-invocation: true
---

# Abrir sesión

Seguí estos pasos en orden y al final mostrá un resumen corto en español.

## 1. Estado local

- `git status --short` y `git branch --show-current`.
- Si hay cambios sin commitear, **avisale al usuario y preguntale** qué hacer (commitear, stashear o seguir) antes de hacer pull. No descartes nada.

## 2. Traer cambios del repo

- Guardá el commit actual: `git rev-parse HEAD`.
- `git pull --ff-only`.
- Si falla (ramas divergentes, conflictos o falta de autenticación), **no fuerces nada**: mostrá el error y proponé cómo resolverlo.

## 3. Dependencias

- Si `package-lock.json` cambió entre el commit anterior y el nuevo (`git diff --name-only <antes> HEAD`), o si no existe `node_modules`, corré `npm install`.

## 4. Ponerse en contexto

- Leé `docs/DECISIONES.md` completo, en especial la tabla de decisiones, la bitácora de sesiones y las preguntas abiertas.
- `git log --oneline -10` para ver lo último que se hizo.

## 5. Resumen para el usuario

Mostrá:
- Qué se trajo del repo (commits nuevos, o "ya estaba al día").
- En qué estado está el proyecto y cuáles fueron las últimas decisiones.
- Los próximos pasos pendientes, según la última entrada de la bitácora.
- Preguntá en qué quiere trabajar hoy.
