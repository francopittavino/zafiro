# Zafiro: Registro de decisiones y contexto

> Documento vivo. Cada sesión que tome una decisión la agrega acá (con fecha).
> Objetivo: que cualquier sesión nueva pueda ponerse en contexto rápido.

## 1. Contexto del proyecto

- **Qué es:** sistema de gestión agronómica a medida para un cliente (ingeniero agrónomo / productor, Argentina).
- **Estado:** prototipo funcionando con los datos reales de la planilla del cliente (ver bitácora 2026-10-01, sesión 2). **Todavía no hubo reunión con el cliente**; hay un audio con ideas generales y su planilla anterior.
- **Lo que dijo el cliente en el audio:**
  - Ya tiene una "base de datos" (formato desconocido).
  - Trabaja varios campos en distintas localidades; los lotes los dibuja/descarga desde Google Earth (ubicación, lotes).
  - En los lotes siembra y pulveriza productos con ciertas dosis.
  - Quiere: lista de productos, qué se aplicó en cada lote, cuánto se gastó por lote/campo, lista de precios,
    generar recetas de lo que se va a aplicar (o cargar recetas).

## 2. Documentos del proyecto

| Archivo | Qué es |
|---|---|
| `docs/Preguntas_Cliente_Relevamiento.pdf` | Cuestionario para la reunión con el cliente (v3: solo lo pendiente después de la planilla y el prototipo) |
| `docs/fuentes/Preguntas_Cliente_Relevamiento.html` | Fuente editable del PDF del cuestionario |
| `docs/ANALISIS_EXCEL_ANTERIOR.md` | Análisis de la planilla anterior del cliente: hojas, fórmulas, pantallas propuestas y campos obligatorios |
| `docs/DECISIONES.md` | Este archivo |
| `CLAUDE.md` | Instrucciones para Claude Code (stack, comandos, convenciones); se carga solo en cada sesión |
| `.claude/skills/open-session`, `close-session` | Skills de inicio (pull + contexto) y cierre (actualizar este doc + commit + push) |
| `src/db/schema.ts` | Esquema de base de datos (Drizzle) |
| `drizzle/` | Migraciones SQL generadas (0005 incluye el bucket de fotos) |
| `scripts/importar-planilla.py` · `scripts/cargar-datos.mjs` | Planilla `.xlsm` → `datos-demo/zafiro.json` → base (`npm run db:cargar`). Los datos no se versionan |
| `public/marca/` | Logo, isotipo e ícono del cliente (sacados de `Logo.jpeg`) |
| Lienzo de diseño | https://claude.ai/artifact/DYoqmYLc8zvf2bMrC9jhou (primeras pantallas, paleta provisoria; la app ya usa la del logo) |

## 3. Modelo de dominio preliminar (a validar con el cliente)

```
Productor/Cliente ─┬─ Campo (localidad, provincia) ── Fotos
                   │     └─ Lote (código, polígono KML, superficie ha) ── Fotos
                   │           └─ Ciclo/Campaña (cultivo, variedad, siembra; cosecha: rinde, pizarra, arrendamiento, gastos, flete)
                   │                 └─ Labor (tipo de labor, fecha, ha, costo labor/ha snapshot, aporte, contratista)
                   │                       └─ LaborInsumo (producto, dosis/ha, cantidad, precio al momento)
                   └─ Receta (nº, fecha, lote, cultivo, plaga, ingeniero) → genera Labor planificada
Producto (nombre, categoría, unidad, principio activo) ── PrecioProducto (proveedor, moneda, precio, fecha)
TipoLabor (nombre, categoría, tarifa en L de gasoil/ha o USD/ha) · Cotización (fecha, tipo de cambio, gasoil) · Aporte
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
| 2026-09-30 | **Vercel**: proyecto `zafiro` (cuenta Hobby), URL https://zafiro-five.vercel.app, deploy automático desde `main` | Conectado vía Chrome |
| 2026-09-30 | **Supabase**: proyecto `zafiro` (ref `joojvijwxzytmmxurebz`), región São Paulo `sa-east-1`, org `francopittavino` (Free); pooler `aws-0-sa-east-1.pooler.supabase.com` | Región más cercana a Argentina |
| 2026-09-30 | Supabase con **Data API desactivada** y **RLS automático activado** | La app accede solo vía Drizzle/Postgres; no exponer tablas por REST |
| 2026-10-01 | **Acceso con PIN único** en la página principal (sin email, sin /login ni /admin). PIN en la env `ACCESO_PIN` | Decisión del dev: un solo usuario. **No** se usa Supabase Auth |
| 2026-10-01 | Sesión en tabla `sesiones` (se guarda el SHA-256 del token; cookie httpOnly `zafiro_sesion`, 30 días) | Revocable desde la base; sin secretos extra |
| 2026-10-01 | Bloqueo por IP: 5 PIN incorrectos en 15 min → bloqueo 15 min (tabla `intentos_acceso`) | El PIN es corto: mitigar fuerza bruta |
| 2026-10-01 | Patrón de auth (Next 16): `proxy.ts` solo chequea que exista la cookie; `verificarSesion()` valida contra la base en cada página/Server Action | Recomendación de la doc de Next |
| 2026-10-01 | Se analizó la planilla anterior del cliente (`docs/ANALISIS_EXCEL_ANTERIOR.md`). El `.xlsm` **no se versiona** (`.gitignore`: `*.xlsm`, `*.xlsx`) porque tiene datos reales del cliente | Privacidad |
| 2026-10-01 | **Una labor = cabecera + N productos** en un solo formulario (reemplaza el "un producto por registro" del Excel). Una labor sin productos es válida | Simplifica la carga, que es lo que más se usa |
| 2026-10-01 | Tipos de labor pasan de enum a **tabla `tipos_labor`** con tarifa en **litros de gasoil/ha** o **USD/ha fijo**; el enum `tipo_labor` queda como categoría (la cosecha se separa en el margen) | Así cotiza el cliente hoy; tiene ~16 labores propias |
| 2026-10-01 | Moneda base **USD**. Tabla `cotizaciones` (fecha, tipo de cambio, precio gasoil) para pasar las tarifas a USD; el costo de labor e insumo se guarda como snapshot | Como en la planilla |
| 2026-10-01 | Nuevas: `aportes` (quién paga, a confirmar), `configuracion` (valores por defecto); `lotes.codigo` (T1, SM 2…) y `superficie_ha` obligatoria; comercialización en `ciclos` (pizarra, arrendamiento % o kg/ha, gastos %, flete, bonificación); unidades `tn`, `bolsa`, `pack`, `dosis`; categorías `fertilizante_foliar`, `inoculante`, `curasemilla` | Datos que usa la planilla |
| 2026-10-01 | Las **hectáreas de la labor son editables** (default: las del ciclo) | En la planilla hay aplicaciones parciales (ej. dron en 180 de 200 ha) |
| 2026-10-01 | Diseño de pantallas mobile-first (8 pantallas, navegación inferior: Inicio · Lotes · [+] Registrar · Historial · Más). Lienzo: https://claude.ai/artifact/DYoqmYLc8zvf2bMrC9jhou. **Paleta provisoria** azul zafiro `#1D4E89` + fuente Public Sans, hasta tener el logo del cliente | El dev pidió el logo al dueño |
| 2026-10-01 | **Marca del cliente**: "Zafiro Agronomía". Paleta del logo: azul marino `#252A61` (primario), azul zafiro `#0B63AE` (acento), amarillo sol `#FFE600` (detalles, nunca texto). Tipografía **Lato** (la del logo). Logo e íconos en `public/marca/` y `src/app/icon.png` | Logo entregado por el dueño |
| 2026-10-01 | UI implementada en Next: celular primero (barra inferior: Inicio · Lotes · [+] · Historial · Más) y en PC barra lateral + tablas. Rutas en `src/app/(app)/`: `/inicio`, `/lotes`, `/lotes/[id]`, `/lotes/[id]/margen`, `/registrar`, `/historial`, `/insumos`, `/labores`, `/informes`, `/mas` | Pedido del dev: ver la app andando |
| 2026-10-01 | **Modo demo** (`npm run demo`): solo con `next dev` + `ZAFIRO_DEMO=1`; saltea PIN y base y lee `datos-demo/zafiro.json` (ignorado por git, con datos reales). Imposible en producción (NODE_ENV) | Ver la app sin `.env.local`; la capa `src/lib/datos.ts` se reemplaza por consultas Drizzle |
| 2026-10-01 | Migraciones `0003` y `0004` **aplicadas** en Supabase. Datos de la planilla **cargados en la base** con `npm run db:cargar` (9 campos, 31 lotes, 85 productos con precio, 16 tipos de labor, 31 labores; campaña 2024/25; cotización 1.080 / gasoil $1.200). Labores sin labor en la planilla → tipo "Aplicación de insumos" | La app ya trabaja con datos reales |
| 2026-10-01 | La app **lee de la base** (`src/lib/datos.ts`) y **guarda/elimina labores** (Server Actions en `src/app/(app)/registrar/acciones.ts`, con `verificarSesion()` y validación en el servidor). El resto de los botones (editar, nuevo precio, + campo/lote, PDF) todavía no hace nada | Primer flujo completo |
| 2026-10-01 | **Pooler de transacción de Supabase + postgres.js**: con consultas en paralelo la página quedaba colgada (no soporta *pipelining*). Solución en `src/db/index.ts`: `max_pipeline: 0` para el cliente general y un cliente aparte (`dbTx`, `max: 1`) **solo para transacciones**. Usar siempre `dbTx.transaction(...)` | Probado: con `max_pipeline` 1 o `max: 1` vuelve a colgarse |
| 2026-10-01 | **Editar y duplicar labor** reutilizan el formulario de carga: `/registrar?labor=ID` (editar: reemplaza la labor y todos sus productos) y `/registrar?duplicar=ID` (nueva con la misma mezcla y fecha de hoy). Al editar se respetan los precios y el costo guardados (snapshot), sin redondear | Un solo formulario para mantener |
| 2026-10-01 | **Nuevo precio** en Insumos: agrega una fila a `precios_producto` con fecha "vigente desde"; el vigente es el de fecha más reciente. Las labores ya cargadas no cambian | Historial de precios |
| 2026-10-01 | Se quitó el campo "Contratista" del formulario hasta implementarlo (no se guardaba) | No mostrar campos que no hacen nada |
| 2026-10-01 | **Altas desde cualquier lista**: en Registrar labor, Lote / Labor / Insumo tienen "+ Nuevo…" (abre el alta en una ventana y deja elegido lo creado); Aporte es texto con sugerencias y se crea solo si es nuevo; en el alta de lote se puede crear el campo en el momento | Pedido del dev: siempre aparecen cosas nuevas |
| 2026-10-01 | Funcionan + Campo, + Lote, Editar lote, + Insumo, + Labor, Actualizar cotización (una por día; reemplaza si ya hay) y PDF (impresión del navegador con estilos de impresión). Acciones en `src/app/(app)/acciones-catalogos.ts`; formularios en `src/components/app/altas.tsx` (ventana con `<dialog>` nativo) | Botones que no hacían nada |
| 2026-10-01 | **Fotos de campos y lotes** en Supabase Storage: bucket **privado** `fotos` (creado en la migración `0005_fotos`, solo JPG/PNG/WEBP hasta 5 MB) + tabla `fotos` (ruta, fecha, nota, medidas; pertenece a un campo, un lote o una labor). El navegador achica la foto a 1600 px en JPEG antes de subirla (~0,3–0,5 MB); se ven con URLs firmadas de 1 hora. Galería en la ficha del lote y en la nueva ficha de campo (`/campos/[id]`) | Pedido del dev; Supabase Free incluye 1 GB |
| 2026-10-01 | Nuevas variables: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (clave secreta, solo servidor; **cargar también en Vercel**). Sin ellas la galería muestra un aviso y no se rompe nada | La app sigue sin usar la Data API |
| 2026-10-01 | Mapa y contornos KML: **se deja para después de la reunión** con el cliente | Decisión del dev |
| 2026-10-01 | Cuestionario **v3**: se agregan fotos (8.3), propuesta de colores del logo (9.4) y listas que cambian seguido (9.5); se avisa que hay un prototipo para mostrar | Preparar la reunión |
| 2026-10-01 | Cuestionario v2 (`docs/Preguntas_Cliente_Relevamiento.pdf`, fuente HTML en `docs/fuentes/`): solo las preguntas que quedan después del Excel | Se regenera con Edge headless |

## 5. Preguntas abiertas

### Con el cliente (ver PDF v3)
- ¿Hay más planillas/campañas para migrar? (la actual ya está cargada en la base).
- Qué significa **"APORTE"** (proveedor, quién paga, dueño del campo).
- Arrendamiento: **% de la producción o tn/ha**; qué es la **bonificación 15%**; cómo se calcula el **flete**.
- Unidades dudosas e insumos de relleno de la planilla (semillas 1..6 a 53 USD).
- ¿Receta fitosanitaria oficial? ¿Provincia?
- Precios siempre en USD? ¿Qué tipo de cambio usa?
- ¿Uso offline en el campo? (define si hace falta PWA con offline)
- ¿Solo él usa el sistema o también otros? (hoy se asume solo el admin)
- ¿Necesita mapa? (define si se hace la carga de KML y el mapa)
- Prioridades para el MVP y plazos.

### Técnicas (pendientes)
- **Cambiar el PIN por uno más largo**: la base ya tiene los datos reales del cliente (se cambia en Vercel sin tocar código).
- **Clave de Storage**: falta `SUPABASE_SECRET_KEY` en `.env.local` y en Vercel (y `SUPABASE_URL` en Vercel). Sin eso no se pueden subir fotos. Una vez cargada, probar subir/ver/borrar.
- La base es **una sola para local y producción**: lo que se cargue en local queda en serio. Evaluar un proyecto/branch de Supabase aparte para desarrollo antes de entregar.
- Vercel: poner las funciones en la región **São Paulo (gru1)**, cerca de la base, para bajar la latencia de cada consulta.
- Mapas (después de la reunión): Leaflet (react-leaflet) + `@tmcw/togeojson` para importar KML/KMZ al `contorno` del lote.
- PDF: hoy se usa la impresión del navegador; para recetas con formato oficial evaluar `@react-pdf/renderer`.
- Al borrar una labor/lote con fotos, el archivo queda en Storage (la fila se borra en cascada). Limpiar cuando se implemente el borrado de lotes o las fotos de labores.

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
- Esqueleto del proyecto: Next.js 16 + Tailwind + shadcn/ui + Drizzle; esquema preliminar de 12 tablas.
- Supabase creado y migraciones **aplicadas** (PostGIS 3.3 + 12 tablas con RLS; verificado cálculo de ha con un polígono de prueba).
- Repo conectado a Vercel (https://zafiro-five.vercel.app).
- Home provisoria con los módulos planificados.
- Skills `open-session` y `close-session`.

### 2026-10-01
- Acceso con PIN en la página principal (tablas `sesiones` e `intentos_acceso`, migración `0002_acceso_pin`). Probado en local: PIN incorrecto, correcto, sesión persistente, salir y bloqueo por intentos.
- Se probó Supabase Auth con email y se descartó por pedido del dev (un solo usuario, solo PIN).
- Deploy en producción verificado: pantalla de PIN en https://zafiro-five.vercel.app y el dev ingresó con su PIN.

**Estado al cierre:** infraestructura y acceso listos. **Se retoma después de la reunión con el cliente** (usar `docs/Preguntas_Cliente_Relevamiento.pdf`): volcar respuestas acá, ajustar el esquema y definir el primer módulo del MVP.

**Próximos pasos:**
1. Reunión con el cliente usando el PDF; volcar las respuestas en este documento y ajustar el esquema.
2. ~~Supabase + migraciones~~ ✔ · ~~Vercel~~ ✔ · ~~`DATABASE_URL` en Vercel (Production + Preview) + redeploy~~ ✔
3. Ojo: el plan Free de Supabase permite 2 proyectos activos (hoy: Los Gladiolos + zafiro; voko-accesorios pausado) y **pausa el proyecto tras ~1 semana sin actividad**. Si al volver la app no conecta, reactivarlo desde el panel de Supabase (Restore project).
4. ~~Acceso del administrador~~ ✔ (PIN, `ACCESO_PIN` cargado en Vercel y probado en producción por el dev).
5. Primer módulo del MVP (según las prioridades del cliente; candidato: productos y lista de precios, o campos y lotes).

### 2026-10-01 (sesión 2)
- Análisis de la planilla anterior del cliente (`docs/ANALISIS_EXCEL_ANTERIOR.md`): hojas, fórmulas, macros, flujo de carga, problemas y propuesta de pantallas con campos obligatorios. El `.xlsm` no se versiona.
- Esquema ajustado y migrado (0003–0005): catálogo `tipos_labor`, `aportes`, `cotizaciones`, `configuracion`, comercialización en `ciclos`, `lotes.codigo`, unidades/categorías nuevas, tabla `fotos` + bucket privado.
- **Datos reales cargados en Supabase** desde la planilla: 9 campos, 31 lotes, 85 insumos con precio, 16 tipos de labor, 31 labores (campaña 2024/25).
- Diseño de pantallas (lienzo) y luego **app implementada** con la marca del cliente (logo, paleta y Lato), celular primero y PC con barra lateral: inicio, campos y lotes (+ ficha de campo y de lote), registrar labor, historial (filtros, exportar CSV), insumos, labores y tarifas, informes, margen bruto.
- Funciona contra la base: registrar, **editar**, **duplicar** y eliminar labores; **nuevo precio** con historial; altas de campo, lote, insumo, labor y aporte (también "+ Nuevo…" desde las listas del formulario); editar lote; cotización; PDF por impresión.
- Fotos de campos y lotes (Supabase Storage, achicadas en el navegador): **implementado, falta la clave secreta para probarlo**.
- Modo demo (`npm run demo`) para recorrer la app sin base ni PIN.
- Bug resuelto: el pooler de transacción de Supabase colgaba las páginas con consultas en paralelo (*pipelining*) → `max_pipeline: 0` + cliente aparte para transacciones (`dbTx`).
- Cuestionario actualizado a v3.
- Todo se probó en local con datos de prueba que se borraron después; la base quedó solo con los datos de la planilla.

**Estado al cierre:** prototipo navegable con datos reales, listo para mostrar en la reunión. Falta la clave de Storage para las fotos.

**Próximos pasos:**
1. Cargar `SUPABASE_SECRET_KEY` en `.env.local` y `SUPABASE_URL` + `SUPABASE_SECRET_KEY` en Vercel; probar fotos (subir, ver, borrar).
2. Verificar el deploy en Vercel con estos cambios (login con PIN, inicio, registrar una labor de prueba y borrarla).
3. Cambiar el PIN por uno más largo.
4. **Reunión con el cliente** con el PDF v3 y el prototipo; volcar respuestas acá (aporte, arrendamiento, bonificación, flete, mapa, prioridades).
5. Pendientes de la app: guardar los datos de cosecha en el margen bruto, contratistas, fotos de labores, ajustes (aportes, cultivos, valores por defecto).
6. Después de la reunión: mapa y contornos KML si el cliente lo necesita.
