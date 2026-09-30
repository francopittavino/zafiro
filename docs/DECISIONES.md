# Zafiro: Registro de decisiones y contexto

> Documento vivo. Cada sesión que tome una decisión la agrega acá (con fecha).
> Objetivo: que cualquier sesión nueva pueda ponerse en contexto rápido.

## 1. Contexto del proyecto

- **Qué es:** sistema de gestión agronómica a medida para un cliente (ingeniero agrónomo / productor, Argentina).
- **Estado:** relevamiento inicial. **Todavía no hubo reunión con el cliente**; solo hay un audio con ideas generales.
- **Lo que dijo el cliente en el audio:**
  - Ya tiene una "base de datos" (formato desconocido).
  - Trabaja varios campos en distintas localidades; los lotes los dibuja/descarga desde Google Earth (ubicación, lotes).
  - En los lotes siembra y pulveriza productos con ciertas dosis.
  - Quiere: lista de productos, qué se aplicó en cada lote, cuánto se gastó por lote/campo, lista de precios,
    generar recetas de lo que se va a aplicar (o cargar recetas).

## 2. Documentos del proyecto

| Archivo | Qué es |
|---|---|
| `docs/Preguntas_Cliente_Relevamiento.pdf` | Cuestionario para la reunión con el cliente (9 secciones + checklist de cosas a pedir) |
| `docs/DECISIONES.md` | Este archivo |
| `CLAUDE.md` | Instrucciones para Claude Code (stack, comandos, convenciones); se carga solo en cada sesión |
| `.claude/skills/open-session`, `close-session` | Skills de inicio (pull + contexto) y cierre (actualizar este doc + commit + push) |
| `src/db/schema.ts` | Esquema de base de datos (Drizzle) |
| `drizzle/` | Migraciones SQL generadas |

## 3. Modelo de dominio preliminar (a validar con el cliente)

```
Productor/Cliente ─┬─ Campo (localidad, provincia)
                   │     └─ Lote (polígono KML, superficie ha)
                   │           └─ Ciclo/Campaña (cultivo, variedad, fecha siembra)
                   │                 └─ Labor (tipo, fecha, contratista, ha, costo labor)
                   │                       └─ LaborInsumo (producto, dosis/ha, cantidad, precio al momento)
                   └─ Receta (nº, fecha, lote, cultivo, plaga, ingeniero) → genera Labor planificada
Producto (nombre, principio activo, unidad, banda tox.) ── PrecioProducto (proveedor, moneda, precio, fecha)
```

Principios ya acordados como recomendación:
- Guardar el **precio del insumo al momento de la aplicación** (snapshot), no solo referencia a la lista; si no, los costos históricos cambian.
- Contemplar **moneda (USD/ARS) y tipo de cambio** en precios y costos.
- Postgres + PostGIS es el candidato natural para polígonos de lotes (pendiente de confirmar stack).

## 4. Decisiones tomadas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-30 | Se arma cuestionario de relevamiento para el cliente (PDF) | Faltan requerimientos; primero reunión |
| 2026-09-30 | **Stack: Next.js full-stack + TypeScript** | El dev maneja Node/TS; un solo proyecto, nativo de Vercel |
| 2026-09-30 | **Deploy: Vercel** (repo en **GitHub**, deploy automático) | Elección del dev |
| 2026-09-30 | **DB: Supabase Postgres** (con **PostGIS** para lotes) | Postgres gestionado, auth y storage incluidos, plan gratis |
| 2026-09-30 | **ORM: Drizzle** | Liviano, buen tipado, SQL directo para PostGIS |
| 2026-09-30 | **UI mobile-first responsive**: el admin hace TODO desde el celular y también desde la PC | Requisito del dev/cliente |
| 2026-09-30 | **Sistema a medida, un solo cliente** (sin multi-tenant) | Decisión del dev |
| 2026-09-30 | **Un solo usuario: el administrador** (por ahora) | Lo que se sabe hoy; a confirmar en la reunión |
| 2026-09-30 | **Solo planes gratuitos** hasta tener parte del sistema desarrollado | Decisión del dev |
| 2026-09-30 | Repo: https://github.com/francopittavino/zafiro (rama `main`) | — |
| 2026-09-30 | Esqueleto: **Next.js 16** (App Router, `src/`), Tailwind v4, **shadcn/ui** (estilo base-nova) | Aprobado por el dev |
| 2026-09-30 | IDs `integer identity`; columnas `snake_case` en la DB y camelCase en TS; montos en `numeric` | Simplicidad y precisión en los montos |
| 2026-09-30 | Contorno del lote como `geometry(MultiPolygon, 4326)` (tipo custom en Drizzle); primera migración habilita PostGIS | Importar KML de Google Earth y calcular hectáreas |
| 2026-09-30 | Entidad **ciclo** = cultivo en un lote en una campaña (permite fina y gruesa en el mismo año) | Modelo agronómico |
| 2026-09-30 | Dos variables de conexión: `DATABASE_URL` (pooler de transacción, 6543) y `DATABASE_URL_MIGRACIONES` (5432) | Requisito de Supabase con Vercel serverless |
| 2026-09-30 | Workflow: `/open-session` (pull) y `/close-session` (actualiza este doc, commit y push) | Continuidad entre sesiones |

## 5. Preguntas abiertas

### Con el cliente (ver PDF)
- Formato de su base actual y si se migra.
- ¿Receta fitosanitaria oficial? ¿Provincia?
- ¿Precios en USD o ARS? ¿Tipo de cambio?
- ¿Uso offline en el campo? (define si hace falta PWA con offline)
- ¿Solo él usa el sistema o también otros? (hoy se asume solo el admin)
- Prioridades para el MVP y plazos.

### Técnicas (pendientes)
- Autenticación: Supabase Auth (sugerido, falta implementar; requiere crear el proyecto de Supabase).
- Mapas: el dev **no tiene experiencia** → sugerencia: Leaflet (react-leaflet) + `@tmcw/togeojson` para importar KML/KMZ. Dejar mapas para una fase posterior al MVP si no es prioridad del cliente.
- Generación de PDF de recetas/informes (sugerencia: `@react-pdf/renderer`).

## 6. Perfil del desarrollador y restricciones

- Desarrolla **solo, part-time** (< 20 hs/semana) → priorizar MVP chico y simple.
- Maneja **Node.js / TypeScript**. Usa **Git + GitHub**.
- **Sin experiencia en mapas/GIS.**
- **No quiere pagar suscripciones** al principio. Tener en cuenta:
  - Vercel **Hobby** es gratis pero sus términos lo limitan a uso **no comercial** → al entregar al cliente habrá que pasar a Pro o a cuentas del cliente.
  - Supabase **Free** pausa el proyecto tras ~1 semana sin actividad y no incluye backups automáticos → ok para desarrollo, revisar para producción.
- Cobro/hosting en producción: **a definir** más adelante.

## 7. Bitácora de sesiones

### 2026-09-30
- Relevamiento inicial: cuestionario para el cliente (`docs/Preguntas_Cliente_Relevamiento.pdf`).
- Definición del stack y despliegue (ver tabla de decisiones).
- Esqueleto del proyecto: Next.js 16 + Tailwind + shadcn/ui + Drizzle; esquema preliminar de 12 tablas y migraciones generadas (**todavía no aplicadas**: no hay proyecto de Supabase creado).
- Home provisoria con los módulos planificados.
- Skills `open-session` y `close-session`.

**Próximos pasos:**
1. Reunión con el cliente usando el PDF; volcar las respuestas en este documento y ajustar el esquema.
2. Crear el proyecto en Supabase (plan gratis), completar `.env.local` y correr `npm run db:migrate`.
3. Conectar el repo a Vercel.
4. Login del administrador con Supabase Auth.
5. Primer módulo del MVP (según las prioridades del cliente; candidato: productos y lista de precios, o campos y lotes).
