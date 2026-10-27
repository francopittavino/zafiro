# Zafiro: Registro de decisiones y contexto

> Documento vivo. Cada sesión que tome una decisión la agrega acá (con fecha).
> Objetivo: que cualquier sesión nueva pueda ponerse en contexto rápido.

## 1. Contexto del proyecto

- **Qué es:** sistema de gestión agronómica a medida para un cliente (ingeniero agrónomo / productor, Argentina).
- **Estado:** implementado lo que pidió el cliente (2026-10-17) y los pedidos del dev del 2026-10-18 (campañas por cultivo con cierre, receta oficial en PDF, mapa en las altas, PDF de labor, inicio simple). Migraciones hasta la **0009 aplicadas**; producción andando y **el cliente ya usa la app** (desde 2026-10-19 pide cambios: coordenadas en grados, minutos y segundos, varios mapas por campo, órdenes de trabajo). **Trabajos de prueba borrados** (2026-10-18): la base tiene campos, lotes, insumos y catálogos, sin cultivos ni campañas; el ingeniero carga todo de cero.
- **Lo que dijo el cliente en el audio:**
  - Ya tiene una "base de datos" (formato desconocido).
  - Trabaja varios campos en distintas localidades; los lotes los dibuja/descarga desde Google Earth (ubicación, lotes).
  - En los lotes siembra y pulveriza productos con ciertas dosis.
  - Quiere: lista de productos, qué se aplicó en cada lote, cuánto se gastó por lote/campo, lista de precios,
    generar recetas de lo que se va a aplicar (o cargar recetas).

### 1.1 Respuestas del cliente (cuestionario v1, 2026-10-17)

| Tema | Respuesta |
|---|---|
| Usuarios | Solo él (ingeniero). Asesora a **otros productores**: ellos no entran al sistema, él les manda **PDF** |
| Uso | PC y celular |
| Hoy | La planilla Excel que pasó |
| Google Earth | **No exporta nada**. Quiere **subir una foto del campo y marcar los lotes con color y lo sembrado**, y también las coordenadas |
| Lotes | No cambian de forma. Datos del lote: todos, **opcionales** |
| Campaña | De la preparación a la cosecha, con todos los gastos (también los de cosecha) para el margen bruto |
| Labores | Que se puedan agregar (ej. pasada de disco). Datos de aplicación: todos, opcionales y **que se puedan agregar** |
| Mezclas de tanque | No · Planificado vs aplicado: **no** |
| Aplicación parcial | A veces en **manchones**: poder marcarlos en el mapa (opcional) |
| Quién hace las labores | Contratistas y máquinas propias; cobro **por hora y por hectárea** |
| Receta | Oficial de **Entre Ríos**; en el sistema, un **resumen** con los datos necesarios, opcionales y con campos agregables; se descarga y se manda al cliente. Las hace solo él |
| Productos | Todos los datos, opcionales, que se puedan agregar o quitar. Precios en **USD**, **varios proveedores**, **sin historial de precios** |
| Stock | **Por campo**, que se descuente al aplicar |
| Costos | Todos y que se puedan agregar (alquiler, flete, seguros…). Por campo, lote, cultivo o general, **seleccionable** |
| Rinde | Sí, en kg/ha |
| Informes | **PDF con buen formato de Zafiro** para el cliente: durante, antes o después de la campaña, con campo, foto, productos, labores, lote, recetas |
| Mapa | Subir la foto, marcar lotes ahí, coordenadas; ver con colores qué hay en cada lote |
| Sin responder | 2.1, 2.2 (historia a migrar), 6.5 (precio de lista o factura), 9.1–9.3 (prioridades, plazos, presupuesto) |

## 2. Documentos del proyecto

| Archivo | Qué es |
|---|---|
| `docs/Preguntas_Cliente_Relevamiento.pdf` | Cuestionario para la reunión con el cliente (v3: solo lo pendiente después de la planilla y el prototipo) |
| `docs/Respuesta cliente.pdf` | Cuestionario v1 respondido por el cliente (resumen en 1.1) |
| `docs/fuentes/Preguntas_Cliente_Relevamiento.html` | Fuente editable del PDF del cuestionario |
| `docs/Guia_Inicio_Zafiro.pdf` | Guía de inicio para el ingeniero (los 7 primeros pasos y el día a día); fuente en `docs/fuentes/Guia_Inicio.html`, se regenera con Edge headless |
| `docs/ANALISIS_EXCEL_ANTERIOR.md` | Análisis de la planilla anterior del cliente: hojas, fórmulas, pantallas propuestas y campos obligatorios |
| `docs/DECISIONES.md` | Este archivo |
| `CLAUDE.md` | Instrucciones para Claude Code (stack, comandos, convenciones); se carga solo en cada sesión |
| `.claude/skills/open-session`, `close-session` | Skills de inicio (pull + contexto) y cierre (actualizar este doc + commit + push) |
| `src/db/schema.ts` | Esquema de base de datos (Drizzle) |
| `drizzle/` | Migraciones SQL generadas (0005 crea el bucket `fotos`; 0007 el bucket `documentos` y el estado del cultivo) |
| `scripts/borrar-trabajos.mjs` | `npm run db:borrar-trabajos`: borra labores, recetas, gastos, stock y cultivos de prueba (sin `--confirmar` solo muestra qué borraría) |
| `scripts/importar-planilla.py` · `scripts/cargar-datos.mjs` | Planilla `.xlsm` → `datos-demo/zafiro.json` → base (`npm run db:cargar`). Los datos no se versionan |
| `public/marca/` | Logo, isotipo e ícono del cliente (sacados de `Logo.jpeg`); `logo-pdf.png` es la versión liviana para los PDF |
| `src/pdf/` | PDF con la marca Zafiro (`@react-pdf/renderer`): receta, informe (en curso, campaña o cierre de un cultivo) y labor; `mapa.tsx` (mapa con el lote resaltado), `unir.ts` (pega la receta oficial con `pdf-lib`) |
| Lienzo de diseño | https://claude.ai/artifact/DYoqmYLc8zvf2bMrC9jhou (primeras pantallas, paleta provisoria; la app ya usa la del logo) |

## 3. Modelo de dominio preliminar (a validar con el cliente)

```
Productor (al que asesora) ─┬─ Campo (localidad, coordenadas, foto del mapa) ── Fotos · Stock (movimientos)
                   │     └─ Lote (código, ha, tenencia, suelo, dibujo sobre la foto) ── Fotos
                   │           └─ Ciclo = cultivo en una campaña (en curso → cerrado a mano; uno solo en curso por lote;
                   │                 variedad, siembra; cosecha: rinde, pizarra, arrendamiento, gastos, flete)
                   │                 ├─ Labor (tipo, fecha, ha, propia/contratista, cobro por ha u hora, aplicación, manchones)
                   │                 └─ Gasto (alquiler, flete, seguro…; también por campo o general)
                   │                       └─ LaborInsumo (producto, dosis/ha, cantidad, precio al momento)
                   └─ Receta (nº correlativo, ciclo, objetivo, productos, condiciones, PDF oficial) → PDF (+ oficial)
                         (una Labor puede vincular la Receta con la que se hizo)
Producto (nombre, categoría, unidad, principio activo) ── PrecioProducto (proveedor, moneda, precio, fecha)
TipoLabor (nombre, categoría, tarifa en L de gasoil/ha o USD/ha) · Cotización (fecha, tipo de cambio, gasoil) · Aporte
CampoPersonalizado (dato extra de campo/lote/insumo/labor/receta; valores en la columna `extras`)
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
| 2026-10-17 | **Productores**: tabla `productores` y `campos.productor_id`. No usan el sistema; reciben PDF | Respuesta 1.2 |
| 2026-10-17 | **Campos personalizados**: tabla `campos_personalizados` (campo, lote, insumo, labor, receta; texto/número/fecha) + columna `extras` (jsonb, id → valor). Se editan en Ajustes; quitar uno lo oculta sin borrar lo cargado | "Que sean opcionales y que se puedan agregar" (3.4, 4.2, 5.2, 6.1) |
| 2026-10-17 | Datos estándar opcionales: lote (tenencia, tipo de suelo, coordenadas; variedad y siembra van en el ciclo), insumo (concentración, formulación, presentación, banda, carencia), campo (coordenadas). Se cargan en un bloque plegable "Más datos" | Que el formulario corto siga corto en el celular |
| 2026-10-17 | Labor: `modalidad` (propia/contratista) + contratista (se elige o se escribe y se crea); `cobro` **por ha** (costo/ha × ha) **o por hora** (horas × USD/hora); datos de aplicación opcionales (caudal, temperatura, humedad, viento, dirección, aplicador) | Respuestas 4.2 y 4.6 |
| 2026-10-17 | **Stock por campo** = suma de `movimientos_stock` (ingreso, aplicación, ajuste). Al guardar una labor se descuentan sus productos del campo del lote (casilla, por defecto sí); editar/borrar la labor rehace/devuelve el stock. El ajuste guarda la diferencia con lo contado. El stock puede quedar negativo (se avisa) | Respuesta 6.6 |
| 2026-10-17 | **Otros gastos** (`gastos` + `categorias_gasto` editables): de un lote, de un campo entero (se reparte por ha entre sus lotes) o generales de la campaña (no se reparten). Entran en el costo del lote y en el margen bruto | Respuestas 3.3 y 7.1 |
| 2026-10-17 | **Recetas**: resumen propio de la receta oficial de Entre Ríos (no la reemplaza). Número correlativo automático, N° de receta oficial opcional, objetivo, tipo de aplicación, caudal, productos con dosis, condiciones/distancias, recomendaciones, observaciones, estado. **No se vinculan a labores** | Respuestas 4.4, 5.1–5.4 |
| 2026-10-17 | **PDF con `@react-pdf/renderer`** en route handlers (`/recetas/[id]/pdf`, `/informes/pdf?productor=&campo=&lote=&cultivo=`), Helvetica, colores del logo; se abren en el navegador para compartir. Datos del ingeniero (nombre, matrícula, contacto) en `configuracion`, editables en Ajustes | Respuesta 7.4; reemplaza la impresión del navegador para lo que se manda al cliente |
| 2026-10-17 | Informes con **filtros** (productor, campo, lote, cultivo) y **agrupación** (campo, lote, cultivo, productor), en pantalla y en PDF | Respuesta 7.2 |
| 2026-10-17 | **Mapa sin GIS**: foto del campo (`campos.foto_mapa_id`, una de sus fotos) y lotes marcados tocando las esquinas sobre la foto (`lotes.dibujo`: puntos relativos 0–1). Color por cultivo. Manchones de una labor en `labores.zonas`. Coordenadas lat/long con link a Google Maps. **Se descarta KML/Leaflet** | Respuestas 2.3, 4.5 y 8.x: no usa Google Earth |
| 2026-10-17 | Cosecha (rinde kg/ha, precio, arrendamiento %, comercialización %, flete) se carga desde la ficha del lote | Respuesta 7.3; antes el formulario no guardaba |
| 2026-10-17 | Historial de precios: **se deja de mostrar** (el cliente no lo quiere); se sigue guardando (el vigente es el último) porque no molesta y las labores guardan su snapshot | Respuesta 6.4 |
| 2026-10-17 | Mezclas de tanque: se mantiene "labor con N productos" (sirve igual con uno solo) | Respuesta 4.3 |
| 2026-10-18 | **PDF de la labor** para el cliente (`/historial/[id]/pdf`): campo y lote, mapa con el lote resaltado y los manchones, datos de la labor, productos, detalle del costo (insumos + labor por ha u hora, total y USD/ha), receta vinculada, labores del lote en la campaña y la última foto del lote. Botón en el historial, en la ficha del lote y al guardar la labor | Pedido del dev |
| 2026-10-18 | **La labor puede vincular una receta** del mismo lote (`labores.receta_id`, ya existía en la base: sin migración). Al elegirla, si no hay productos cargados, se copian los de la receta. Reemplaza "las recetas no se vinculan a labores" del 2026-10-17 | Que la receta salga en el PDF de la labor |
| 2026-10-18 | **Mapa en todos lados**: al dar de alta o editar un lote aparece el mapa del campo para marcarlo; en la ficha del campo el mapa va primero en el celular y cada lote muestra su cultivo; los PDF de receta, informe y labor muestran el mapa del campo con el lote correspondiente resaltado (`src/pdf/mapa.tsx`) | Pedido del dev |
| 2026-10-18 | **Campaña por cultivo**: cada lote tiene **un solo cultivo en curso** (`ciclos.estado`, índice único parcial). Labores, recetas, gastos y cosecha van al cultivo en curso; sin cultivo en curso no se puede registrar. Se **cierra a mano** desde la ficha del lote (fecha de cierre) → informe de cierre (`/informes?ciclo=ID` y su PDF) con costos, margen bruto, insumos y labores. Después se inicia el próximo cultivo (cultivo, variedad, siembra y campaña; la campaña se crea si es nueva). Un cultivo cerrado se puede **reabrir** si el lote no empezó otro. Al editar algo de un cultivo cerrado, queda en ese cultivo | Pedido del dev |
| 2026-10-18 | La app trabaja con los **cultivos en curso** (pueden ser de campañas distintas); Informes permite elegir una **campaña completa** (en curso + cerrados). `datosDe(alcance)` en `src/lib/datos.ts`: `en_curso`, `campania:ID` o `ciclo:ID` | Separar campos y cultivos por campaña |
| 2026-10-18 | **Receta oficial de la provincia en PDF**: se sube al crear o desde la ficha (bucket privado `documentos`, solo PDF hasta 10 MB, migración 0007). Al exportar la receta (y la labor que la tiene vinculada) salen **las dos juntas** (resumen + oficial, con `pdf-lib`) | Pedido del dev |
| 2026-10-18 | **Latitud y longitud obligatorias** en campo y lote (en el lote se proponen las del campo). Se pueden pegar juntas como las copia Google Maps o tomar la ubicación del celular | Pedido del dev |
| 2026-10-18 | **Foto del mapa en el alta del campo**, y en el alta/edición de lote: si el campo no tiene foto se sube ahí mismo y se marca el lote tocando las esquinas | El dev no encontraba dónde cargar el mapa |
| 2026-10-18 | **Inicio simple**: botones Registrar labor / Nueva receta, "Para hacer" (lotes cosechados sin cerrar, lotes sin cultivo), campos con el cultivo de cada lote y últimas labores, **sin montos** (quedan en Informes y en cada lote) | "Que no se pierda en tantos números" |
| 2026-10-18 | Informes: el filtro de **productor** se ve siempre; con varios campos el PDF agrega "Resumen por cultivo y por campo" (el mismo cultivo repartido en varios campos de un productor) | Pedido del dev |
| 2026-10-18 | Si el almacenamiento falla (variables mal cargadas), las pantallas **no se rompen**: muestran el motivo (ej. "SUPABASE_URL no es una dirección válida") | En producción las páginas con fotos daban error 500 |
| 2026-10-18 | Borrar los trabajos de prueba con `npm run db:borrar-trabajos` (sin `--confirmar` solo muestra qué borraría): labores, recetas, gastos, stock, cultivos y campañas vacías. **Quedan** campos, lotes, insumos, tipos de labor y catálogos. **Se corrió el 2026-10-18** (31 labores, 83 productos aplicados, 31 cultivos y la campaña 2024/25); copia en JSON fuera del repo | Pedido del dev: el ingeniero carga todo de cero |
| 2026-10-18 | La app funciona **sin campañas**: si no hay ninguna, se usa la de la fecha (`campaniaSugerida`, junio a mayo) y se crea al iniciar el primer cultivo o cargar un gasto | Después del borrado no quedó ninguna campaña |
| 2026-10-18 | `SUPABASE_URL` corregida en Vercel (Production) + redeploy. Las variables de Supabase están solo en Production | Subir la foto del campo daba "SUPABASE_URL no es una dirección válida" |
| 2026-10-19 | **Coordenadas en grados, minutos y segundos** (`59°15'19.07"O`, `32°28'57.14"S`) en los formularios y las fichas de campo y lote. En la base siguen en grados decimales (sin migración). Se acepta también `59 15 19,07` (sin letra = sur/oeste), decimales y pegar el par desde Google Maps; al salir del campo se ordena al formato. `src/lib/coordenadas.ts` | Pedido del cliente (ya usa la app) |
| 2026-10-19 | **Varios mapas por campo**: cualquier foto del campo puede ser mapa (`fotos.es_mapa`) y cada lote se marca sobre uno (`lotes.mapa_id`; el dibujo es relativo a esa foto). Sirve para lotes lejos entre sí o una foto por lote. En la ficha del campo: "+ Mapa", elegir mapa, marcar lotes y quitar un mapa (sus lotes quedan sin marcar). En el alta/edición del lote se elige el mapa o se sube otra foto ahí mismo. Manchones y PDF usan el mapa del lote; el informe saca un mapa por foto. Migración **0008 aplicada** (pasó el mapa de Barreto Raíces y BRAUER, con B1 y B4). `campos.foto_mapa_id` queda en desuso: borrarla en una migración futura | Pedido del cliente: los lotes de un campo no entran en una sola foto |
| 2026-10-19 | **Órdenes de trabajo** (`/ordenes`, tablas `ordenes_trabajo`, `orden_items`, `orden_gastos`; migración **0009 aplicada**): lo que se va a hacer en un lote, para mandarle al productor en PDF antes de hacerlo. Número correlativo, labor, superficie, fecha prevista, quién la hace y cómo se cobra, instrucciones, productos con dosis y precio estimado, otros gastos (flete…), receta vinculada (se copia su mezcla) y casilla "mostrar costos en el PDF". El PDF trae campo, lote, mapa, trabajo, productos, costo estimado y la **receta anidada** (+ la oficial al final). Estados: pendiente, enviada, realizada, anulada. **"Ya se hizo: registrar la labor"** abre Registrar con los datos de la orden y al guardar la orden queda realizada (si se borra la labor, vuelve a pendiente). Una orden = un lote (como las recetas). Los otros gastos de la orden son estimados: no se cargan solos como gastos | Pedido del cliente |
| 2026-10-27 | **Informe de un solo lote** (filtro de lote o cierre de un cultivo): el PDF trae solo el mapa donde está marcado ese lote (resaltado) y la última foto del lote, sin la foto del campo. Los informes de campo o de productor siguen con todos los mapas de sus campos | Error que reportó el cliente: el informe de un lote traía los mapas de todos los lotes del campo |

## 5. Preguntas abiertas

### Con el cliente
- **Prioridades, plazos y presupuesto** (9.1–9.3 quedaron sin responder).
- ¿El costo se calcula con precio de lista o de factura? (6.5 sin responder; hoy: el precio que se carga en la labor).
- ¿Hay más planillas/campañas para migrar? (2.1/2.2 sin responder; la actual ya está cargada en la base).
- ¿Qué datos de la receta oficial de Entre Ríos son imprescindibles en el resumen? (hoy: los del formulario + campos propios).
- ¿Quiere numerar las recetas desde algún número en particular? (hoy arranca en 1).
- Qué significa **"APORTE"** (proveedor, quién paga, dueño del campo).
- Arrendamiento: **% de la producción o tn/ha**; qué es la **bonificación 15%**; cómo se calcula el **flete**.
- Unidades dudosas e insumos de relleno de la planilla (semillas 1..6 a 53 USD).
- ¿Receta fitosanitaria oficial? ¿Provincia?
- Precios siempre en USD? ¿Qué tipo de cambio usa?
- ¿Uso offline en el campo? (respondió "ambas" para PC y celular; no aclaró si hay señal).

### Técnicas (pendientes)
- **Cambiar el PIN por uno más largo**: la base ya tiene los datos reales del cliente (se cambia en Vercel sin tocar código).
- **Probar en el navegador (celular y PC)** lo del 2026-10-18: inicio, alta de campo con foto del mapa, alta de lote marcándolo en el mapa, coordenadas ("Usar mi ubicación", pegar desde Google Maps), cerrar/reabrir/iniciar cultivo, subir la receta oficial. Se verificó compilando, abriendo las páginas y con pruebas en la base, no a mano en pantalla.
- Los campos y lotes existentes **no tienen coordenadas**: al editarlos las pide (ahora son obligatorias).
- El historial de labores y la ficha del lote muestran solo el cultivo en curso; lo cerrado se ve en el informe de cierre. Evaluar un filtro por campaña en el historial si hace falta.
- La base es **una sola para local y producción**: lo que se cargue en local queda en serio. Evaluar un proyecto/branch de Supabase aparte para desarrollo antes de entregar.
- Vercel: poner las funciones en la región **São Paulo (gru1)**, cerca de la base, para bajar la latencia de cada consulta.
- Ningún campo tiene todavía foto de mapa: el mapa en los PDF se probó solo con una foto de ejemplo generada.
- La columna `lotes.contorno` (PostGIS) queda sin uso: el mapa usa `lotes.dibujo`.
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

### 2026-10-17
- Se leyó la respuesta del cliente (`docs/Respuesta cliente.pdf`, resumen en 1.1) y se implementó todo lo pedido. 5 commits locales (sin push).
- Migración `0006_productores_stock_gastos` (**generada, sin aplicar**: Supabase estaba pausado).
- Nuevo: productores; ajustes (datos propios, contratistas, proveedores, categorías de gasto, aportes, datos del ingeniero); otros gastos; stock por campo; cosecha; recetas con PDF; informes con filtros y PDF; mapa sobre foto con lotes por cultivo y manchones; labores con contratista, cobro por hora y datos de aplicación; datos opcionales en campo, lote e insumo; edición de campo e insumo.
- Navegación: en PC barra lateral con todas las secciones; en el celular, "Más" agrupa productores, recetas, informes, stock, gastos, insumos, labores y ajustes.
- Verificado: `tsc`, `eslint` y `next build` sin errores; PDF de receta e informe generados con datos de prueba y revisados. **No se probó nada contra la base** (pausada).

**Estado al cierre:** código listo en local; falta reactivar Supabase, migrar, probar y desplegar.

**Próximos pasos:**
1. Reactivar Supabase (Restore project) → `npm run db:migrate` → `npm run dev` y probar: productor, campo con productor, lote con datos opcionales, labor con contratista/por hora/manchones/stock, ingreso y ajuste de stock, gasto de campo, cosecha, receta + PDF, informe + PDF, mapa (subir foto y marcar lotes), ajustes.
2. Cargar `SUPABASE_SECRET_KEY` (fotos y mapa no andan sin eso).
3. Push a `main` (deploy) recién con la migración aplicada.
4. Cargar en Ajustes los datos del ingeniero y crear los productores con sus campos.
5. Preguntar al cliente lo que quedó sin responder (prioridades, plazos, presupuesto, precio de lista o factura).

### 2026-10-18
- Abrir sesión: el repo estaba al día; se cargaron `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en `.env.local` (probadas contra Storage) y el dev las cargó en Vercel. La migración 0006 ya estaba aplicada.
- **PDF de la labor** para el cliente (campo, lote, mapa con manchones, productos, detalle del costo, receta vinculada, labores del lote). Mapa con el lote resaltado en los PDF de receta, informe y labor.
- **PDF de muestra** para mostrarle al cliente (6, con datos reales de Estancia Santa Marta y una foto aérea de ejemplo): se copiaron al escritorio del dev en "Zafiro - PDF de muestra". Al revisarlos se corrigieron cortes de hoja.
- En producción las pantallas con fotos (y los PDF) daban **error 500**; ahora andan. No se confirmó la causa (probable: espacios en las variables de Vercel, que ahora se recortan) y un error de almacenamiento ya no rompe la página.
- **Campañas por cultivo** (migración 0007, aplicada): cultivo en curso por lote, cierre manual con informe de cierre, reabrir, iniciar el siguiente. Informes por campaña, filtro de productor siempre visible y resumen por cultivo y campo.
- **Receta oficial en PDF** (bucket `documentos`), exportada junto al resumen. Al borrar una receta se desvinculan sus labores.
- Coordenadas obligatorias, foto del mapa en el alta del campo y en el alta de lote, inicio sin montos.
- Script `db:borrar-trabajos`: se corrió a pedido del dev (31 labores, 83 productos aplicados, 31 cultivos y la campaña 2024/25; copia JSON fuera del repo). Quedan 9 campos, 31 lotes, 85 insumos y 16 tipos de labor. La app se ajustó para funcionar sin campañas.
- Subir la foto del campo en producción daba "SUPABASE_URL no es una dirección válida": se corrigió `SUPABASE_URL` en Vercel desde Chrome y se redesplegó. **No se probó la subida después** (la clave secreta está oculta en Vercel y no se pudo verificar).
- **Guía de inicio** para el ingeniero: un doc en claude.ai y el PDF con la marca (`docs/Guia_Inicio_Zafiro.pdf`, 5 hojas, énfasis en los 7 primeros pasos), copiado al escritorio del dev.
- La subida de fotos en producción **anda** (el dev subió la foto del mapa de Barreto Raíces). A pedido del dev se borró esa foto y los contornos de B1 y B4 marcados sobre ella: el campo queda para volver a subir la foto y marcar sus lotes.
- Commits: `0b5e2e5`, `9d70eb8`, `77bd8a2`, `51acfe1`, `0756d93`, `1889eb7`, `001c36e`.

**Estado al cierre:** todo desplegado; la base quedó limpia (sin cultivos ni campañas) para que el ingeniero arranque con la guía.

**Próximos pasos:**
1. Subir de nuevo la foto del mapa de Barreto Raíces y marcar B1 y B4.
2. Darle al ingeniero la guía de inicio y acompañar los 7 primeros pasos (datos propios, productores, coordenadas y foto de cada campo, lotes en el mapa, iniciar cultivos, precios, cotización).
3. Recorrer en el celular lo nuevo (ver Preguntas abiertas → Técnicas).
4. Mostrarle al cliente los PDF de muestra y preguntarle lo que quedó sin responder (prioridades, plazos, presupuesto, precio de lista o factura).
5. Cambiar el PIN por uno más largo (en local es `0000`).

### 2026-10-19
- Entrada reconstruida el 2026-10-27 a partir de los commits y de la tabla de decisiones (esa sesión no escribió bitácora).
- Coordenadas en grados, minutos y segundos (`746f55f`).
- Varios mapas por campo, migración 0008 aplicada (`4830ad1`).
- Órdenes de trabajo con PDF para el productor y la receta anidada, migración 0009 aplicada (`67f21d1`).
- Arreglo: la ficha del lote se caía cuando el lote estaba marcado en un mapa (`6979e87`).

### 2026-10-27
- Abrir sesión: se trajeron los 4 commits del 2026-10-19.
- **Arreglo del informe de un lote**: el PDF traía los mapas de todos los lotes del campo; ahora trae solo el mapa y la foto del lote (`f41b396`). El dev lo probó en producción y anda bien.
- Los tipos de rutas generados estaban viejos (faltaba `/ordenes`) y `tsc` fallaba: se regeneran con `npx next typegen`.

**Próximos pasos:**
1. Acompañar al ingeniero con los 7 primeros pasos de la guía de inicio.
2. Revisar en el celular lo nuevo: varios mapas, órdenes de trabajo, coordenadas, cerrar/reabrir cultivo.
3. Cambiar el PIN por uno más largo.
4. Preguntarle al cliente lo que quedó sin responder (prioridades, plazos, presupuesto, precio de lista o factura).
5. Migración para borrar `campos.foto_mapa_id` (en desuso).
