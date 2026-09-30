@AGENTS.md

# Zafiro

Sistema de gestión agronómica (campos, lotes, aplicaciones, recetas, costos) para un cliente en Argentina.

**Antes de trabajar, leé `docs/DECISIONES.md`**: tiene el contexto, el modelo de dominio preliminar, las decisiones tomadas y las preguntas abiertas.
Cuando se tome una decisión nueva, agregala a la tabla de decisiones de ese archivo, con fecha.

- Idioma: español (rioplatense). Nombres de tablas, columnas y dominio en español.
- Sesiones: `/open-session` al empezar (pull + contexto) y `/close-session` al terminar (actualiza DECISIONES.md, commit + push).

## Stack

Next.js 16 (App Router, `src/`) + TypeScript · Tailwind v4 + shadcn/ui · Drizzle ORM + Supabase Postgres (PostGIS) · deploy en Vercel desde GitHub.

## Comandos

- `npm run dev`: servidor local.
- `npm run build` / `npm run lint` / `npx tsc --noEmit`.
- `npm run db:generate`: genera la migración a partir de `src/db/schema.ts`.
- `npm run db:migrate`: aplica las migraciones (usa `DATABASE_URL_MIGRACIONES` de `.env.local`).
- `npm run db:studio`: explorador de la base de datos.

## Base de datos

- Esquema en `src/db/schema.ts`; conexión en `src/db/index.ts` (`casing: "snake_case"`, los campos en TS son camelCase).
- Contornos de lotes: tipo custom `multiPoligono` (`src/db/postgis.ts`). Se escribe con GeoJSON y se lee con `ST_AsGeoJSON(...)`.
- `numeric` se devuelve como string; guardar el precio del insumo al momento de aplicarlo (snapshot).
