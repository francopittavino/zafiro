# Análisis del Excel anterior del cliente

> Fuente: `Anterior excel zafiro.xlsm` (raíz del repo), analizado el 2026-10-01.
> Objetivo: entender cómo trabaja hoy el cliente para definir pantallas, botones y datos obligatorios de Zafiro.

## 1. Resumen

El Excel es un **registro de labores e insumos por lote** con un cálculo de **margen bruto** al final de la campaña.
Todo se carga desde un formulario (hoja `REGISTRO`) y una macro copia los valores como una fila nueva en una tabla (`BASE DE DATOS`).
Los informes se arman a mano (hojas `girasol`, `informe`, una tabla dinámica y un gráfico).

Datos que tiene hoy:

| Qué | Cantidad |
|---|---|
| Campos (establecimientos) | 9 |
| Lotes | 31 (2.504 ha en total; la planilla muestra 2.524, un total desactualizado) |
| Insumos (productos con precio) | 85 |
| Tipos de labor (con tarifa) | 16 |
| "Aportes" (quién pone/paga) | 5: BUATTI SRL, PROPIO, GIORDAN, TERCERO, SANTA MARTA |
| Registros en la base | 108 filas, del 25/05/2024 al 15/02/2025, en 17 lotes |
| Cultivos usados | SOJA, GIRASOL, SORGO, TRIGO/SOJA |

**Moneda:** todo en **USD** (la hoja dice `u$$`). Las labores se cotizan en **litros de gasoil por ha** y se pasan a USD con el precio del gasoil en pesos y el tipo de cambio.

## 2. Hojas, una por una

### `LOTES` (título "ESTABLECIMIENTOS")
Columnas: `CODIGO`, `CAMPO`, `LOTE`, `HAS`, `CULTIVO`.
- El **código** es texto libre que mezcla un código corto y una abreviatura: `T1  ESTIG PLA`, `SM 3    ESTSM MAL`, `LG 1   ENTRADA`. Es lo que se elige en los desplegables.
- El **cultivo es un dato fijo del lote** (no hay campañas). Cuando hay doble cultivo se escribe `TRIGO/SOJA`.
- Una superficie es fórmula (`=60+20`), así que el lote se armó juntando dos partes.

### `INSUMOS`
Columnas: nombre, unidad, `TIPO`, `PRECIO` (USD por unidad).
- **Unidades:** `LTS`, `KG`, `TN`, `PACK`, `DOSIS`, `BLS` (bolsa).
- **Tipos:** HERBICIDA, INSECTICIDA, FUNGUICIDA, ADHERENTE, FERTILIZANTE, FERT FOLIAR, INOCULANTE, SEMILLA, OTRO.
- Un solo precio por producto, sin fecha ni proveedor.
- Hay ítems de relleno: `SEMILLA DE MAIZ 1..5`, `SEMILA DE SOJA 5/6`, `SEMILLA DE SORGO 3..6` (todos con precio 53, que parece copiado) y `ninguno`, que se usa para registrar una labor sin producto.
- Hay precios calculados a mano: FINNESSE `=54.54/150*1000`. El precio unitario se calcula a partir del precio del envase.
- Algunas unidades se ven raras y hay que revisarlas con el cliente: CLETODIN 36% en KG y 24% en LTS, PARAQUAT en KG, HALOXIFOP en KG.

### `LABORES`
Columnas: nombre de la labor, **litros de gasoil por ha** y costo en USD/ha (`= litros × precio gasoil / tipo de cambio`).
- Parámetros arriba: gasoil **$1.200/L**, tipo de cambio **1.080**.
- Labores: rastra disco pesado (35 L), rastra 2ª pasada (25), rastra diamante (25), rastra de dientes (18), rastrón (25), pulverización (6), fertilización (8), siembra fina (35), siembra gruesa (35), fertilización Investa (10), dron (15), avión (16), cosecha propia (60 L; costo fijo **70 USD/ha**), cosecha de terceros y servicio contratado (sin tarifa).
- "FERTILIZACION" aparece dos veces.

### `APORTE`
Lista de quién "aporta" el insumo o la labor: BUATTI SRL, PROPIO, GIORDAN, TERCERO, SANTA MARTA.
Todas las filas cargadas dicen BUATTI SRL. **A confirmar con el cliente:** ¿es el proveedor, el socio que paga o el dueño del campo?

### `REGISTRO`: el formulario de carga
Tiene tres bloques y cuatro botones.

**Bloque lote** (columna izquierda)
| Campo | Cómo se carga |
|---|---|
| LOTE | desplegable (lista `LOTES`) |
| HECTAREAS | automático, sale del lote |
| CULTIVO | automático, sale del lote |
| FECHA | manual |
| LABOR | desplegable (lista `LABORES`) |
| COSTO LABOR (u$$/ha) | automático, sale de la tarifa de la labor |

**Bloque insumo** (centro), **un solo producto por registro**
| Campo | Cómo se carga |
|---|---|
| PRODUCTO | desplegable (lista `INSUMOS`) |
| INSUMO (tipo) | automático |
| DOSIS (por ha) | manual |
| COSTO / UNIDAD | automático, precio del insumo |
| COSTO / HA | `costo unidad × dosis` |
| COSTO TOTAL | `costo/ha × ha + ha × costo labor` |
| APORTE | desplegable (lista `APORTE`) |

**Bloque cosecha y comercialización** (derecha)
| Campo | Cómo se carga |
|---|---|
| PRODUCCION (kg/ha) | manual |
| ARRENDAMIENTO (% de la producción) | manual (ej. 0,25) |
| KG NETOS | `(producción − producción × arrendamiento) × ha` |
| GASTOS (comercialización) | `tn netas × precio pizarra × 5%` |
| FLETE | `tn netas × tarifa` (tarifa 27 USD/tn = $30.000 / TC; hay un "180 km" anotado) |
| PRECIO PIZZARRA (USD/tn) | manual |
| INGRESO | `tn netas × precio − flete − gastos` |

**Botones**
| Botón | Qué hace |
|---|---|
| **REGISTRAR** | Inserta una fila arriba de todo en `BASE DE DATOS` con los valores (no fórmulas) y limpia lote, producto, dosis, labor, producción, arrendamiento y precio. La fecha queda. |
| **IR A BASE DE DATOS** | Navega a la hoja de la base. |
| **NUEVO** | **Roto**: apunta a una macro que no existe. |
| **BUSCAR** | **Roto**: la macro no existe. La hoja `BUSCAR` solo trae la **primera** fila del lote elegido. |

En `BASE DE DATOS` hay un botón **REGISTRO** que vuelve al formulario.

### `BASE DE DATOS`
Tabla `DATOS` con una fila por registro: LOTE, HAS, CULTIVO, FECHA, LABOR, COSTO (labor/ha), PRODUCTO, DOSIS, COSTO/UNIDAD, COSTO/HA, COSTO TOTAL, APORTE, PRODUCCION, ARRENDO, KG NETOS, GASTOS, FLETE, PRECIO PIZZARRA, INSUMO (tipo), INGRESO BRUTO y tres columnas vacías.

**Cómo la usa en la práctica**, que es clave para el diseño:
- Una pulverización con 4 productos son **5 filas**: 4 con el producto (sin labor) y 1 con la labor `PULVERIZACION` y el producto `ninguno`.
- A veces la labor y el producto van en la misma fila (DRON + PARAQUAT, FERTILIZACION INVESTA + UREA).
- La cosecha se cargó como una fila aparte, solo con los datos de comercialización (1 caso: girasol SM1, 3.250 kg/ha, arriendo 25%, pizarra 340 USD/tn).
- Las **hectáreas a veces se corrigen a mano** y no coinciden con las del lote (T5: 64 ha contra 78; T1: 30 contra 35; dron sobre 180 de 200 ha). **Las ha trabajadas tienen que ser editables.**
- Hay totales sueltos pegados debajo de la tabla.

### `Hoja8`: tabla dinámica
Agrupa la base por LOTE › HAS › CULTIVO › FECHA › LABOR › PRODUCTO y suma el COSTO TOTAL. Es la "ficha de costos del lote".

### `girasol` e `informe` + `Gráfico1`: margen bruto
Copia manual de las filas del lote SM1 (girasol, 200 ha), separando costo de insumos, de laboreo y de cosecha. El informe arma:

- costo total = insumos + laboreo + cosecha
- ingreso bruto (×1,15 por "bonificación 15%")
- gasto de comercialización, flete
- **margen bruto** total y **por ha**
- todo expresado también en **toneladas de grano por ha** (`importe / precio pizarra / ha`)
- arrendamiento 0,8 tn/ha, rendimiento 3,2 tn/ha

Tiene el precio (340) y las ha (200) **escritos a mano en las fórmulas**. El gráfico de barras muestra esos rubros en tn/ha.

## 3. Problemas del Excel que Zafiro resuelve

1. **Un producto por registro**: cargar una pulverización con 5 productos implica 5 o 6 registros que repiten lote, fecha y ha.
2. **El cultivo está pegado al lote**: no hay campañas ni doble cultivo real (`TRIGO/SOJA` es un texto). → Entidad **ciclo** (ya está en el esquema).
3. **No se puede editar ni borrar** un registro desde el formulario; BUSCAR y NUEVO no funcionan.
4. **Precio sin historia**: un solo precio por insumo. La macro sí guarda el valor (snapshot), algo que Zafiro ya contempla.
5. **Informes armados a mano** por lote, con valores fijos en las fórmulas.
6. Ítems basura en los catálogos ("ninguno", semillas 1..6 con precio de relleno, "FERTILIZACION" duplicada).
7. **Dos formas distintas de arrendamiento** (% de producción en REGISTRO y tn/ha en el informe).

## 4. Propuesta de pantallas para Zafiro

Mobile-first: en el celular, una lista con tarjetas y un botón flotante "+"; en la PC, una tabla.

### 4.1 Inicio (tablero)
- Selector de **campaña** (ej. 2024/25).
- Tarjetas: ha sembradas, costo total de la campaña, costo promedio por ha, últimas labores cargadas.
- Accesos rápidos: **+ Registrar labor**, **Lotes**, **Insumos**, **Informes**.

### 4.2 Campos y lotes
- **Lista agrupada por campo** (con ha totales por campo). Buscador.
- Botones: **+ Campo**, **+ Lote**. (Más adelante: **Importar KML** de Google Earth.)
- **Ficha del lote**: datos, cultivo de la campaña actual, historial de labores (lo que hoy da la tabla dinámica), costo acumulado y costo por ha. Botones: **Editar**, **Registrar labor en este lote**, **Nuevo ciclo**.

| Campo (Campo) | Oblig. | Nota |
|---|---|---|
| Nombre | ✔ | ej. ESTANCIA TIGRECITO |
| Localidad / provincia | — | |
| Notas | — | |

| Lote | Oblig. | Nota |
|---|---|---|
| Campo | ✔ | |
| Nombre | ✔ | ej. PARAISO NUEVO |
| Código corto | — | ej. T4 (único si se carga); hoy lo usa para identificar lotes |
| Superficie (ha) | ✔ | Mientras no haya mapas se carga a mano |
| Activo | ✔ (def. sí) | Para ocultar lotes que ya no trabaja sin borrar historia |
| Contorno (KML) | — | Fase posterior |

### 4.3 Ciclos (cultivo por campaña)
Se crea desde la ficha del lote o al registrar la primera labor de la campaña.

| Campo | Oblig. | Nota |
|---|---|---|
| Lote | ✔ | |
| Campaña | ✔ | ej. 2024/25 |
| Cultivo | ✔ | lista: soja, maíz, girasol, sorgo, trigo, … |
| Fina / gruesa (o 1ª / 2ª) | — | Para el trigo/soja |
| Superficie (ha) | ✔ (def. la del lote) | |
| Variedad / híbrido, fecha de siembra | — | |

### 4.4 Registrar labor (reemplaza `REGISTRO`): la pantalla principal
**Un solo formulario con la labor y todos sus productos.**

Cabecera:
| Campo | Oblig. | Default / cálculo |
|---|---|---|
| Lote | ✔ | Buscador por nombre o código |
| Ciclo (cultivo) | ✔ | El ciclo de la campaña actual del lote; si no hay, se crea ahí mismo |
| Fecha | ✔ | Hoy (el Excel mantenía la última fecha usada, así que conviene recordarla) |
| Tipo de labor | ✔ | Lista del catálogo de labores |
| Hectáreas trabajadas | ✔ | Las del ciclo, **editables** |
| Costo labor (USD/ha) | — | Sale de la tarifa; editable; se guarda como snapshot |
| Contratista / quién hizo la labor | — | |
| Aporte (quién paga) | — | Lista; recordar el último usado |
| Observaciones | — | |

Productos (0 a N líneas; botón **+ Agregar producto**):
| Campo | Oblig. | Default / cálculo |
|---|---|---|
| Producto | ✔ | Buscador; muestra tipo y unidad |
| Dosis por ha | ✔ | En la unidad del producto (L, kg, tn, bolsa…) |
| Precio unitario (USD) | ✔ | El vigente; editable; se guarda como snapshot |
| Cantidad total | calc. | dosis × ha |
| Costo/ha y costo total | calc. | |

Pie: **total de la labor** (labor + insumos), total por ha.
Botones: **Guardar**, **Guardar y cargar otra** (mantiene lote y fecha, que era el flujo del Excel), **Cancelar**.

Una labor sin productos (rastra, siembra, cosecha) es válida. Reemplaza el truco del producto "ninguno".

### 4.5 Historial de labores (reemplaza `BASE DE DATOS` y `BUSCAR`)
- Lista ordenada por fecha (más nuevas primero).
- **Filtros:** campaña, campo, lote, cultivo, tipo de labor, producto, aporte, rango de fechas.
- Cada fila se abre en el detalle con **Editar**, **Duplicar** (para repetir la misma mezcla en otro lote: muy útil) y **Eliminar** (con confirmación).
- **Exportar a Excel** (el cliente viene de ahí).

### 4.6 Insumos y precios
- Lista con buscador y **filtro por tipo**; muestra unidad y precio vigente.
- Botones: **+ Insumo**, **Editar**, **Actualizar precio** (agrega un precio con fecha y conserva el historial), **Desactivar**.
- Opcional: **actualización masiva de precios** (tabla editable), útil cuando llega una lista nueva del proveedor.

| Campo | Oblig. | Nota |
|---|---|---|
| Nombre comercial | ✔ | único |
| Tipo | ✔ | herbicida, insecticida, fungicida, adherente, fertilizante, fert. foliar, inoculante, semilla, curasemilla, otro |
| Unidad | ✔ | L, kg, tn, bolsa, pack, dosis |
| Precio unitario (USD) | ✔ al crear | Con fecha (def. hoy) |
| Principio activo / concentración | — | ej. Glifosato 66% |
| Proveedor | — | |
| Ayuda "precio por envase" | — | ej. $54,54 por envase de 150 g, para calcular el precio unitario (hoy lo hace con fórmulas) |

### 4.7 Labores (catálogo y tarifas)
| Campo | Oblig. | Nota |
|---|---|---|
| Nombre | ✔ | ej. Pulverización terrestre |
| Forma de cotizar | ✔ | **litros de gasoil/ha** o **USD/ha fijo** |
| Litros/ha o USD/ha | ✔ | |
| Activa | ✔ | |

El costo en USD/ha se recalcula con los parámetros de configuración. Al registrar, se **congela** el valor.

### 4.8 Cosecha y comercialización (bloque derecho de `REGISTRO`)
Una por ciclo. Se carga al cosechar, desde la ficha del lote o del ciclo.

| Campo | Oblig. | Nota |
|---|---|---|
| Rinde (kg/ha) | ✔ | |
| Precio pizarra (USD/tn) | ✔ | |
| Arrendamiento | — | % de la producción **o** tn/ha fijas (a confirmar) |
| Gastos de comercialización (%) | — | def. 5% |
| Flete (USD/tn) | — | def. de configuración |
| Bonificación (%) | — | aparece un 15% en el informe; a confirmar |
| Kg netos, ingreso bruto, ingreso neto | calc. | |

### 4.9 Informes
1. **Margen bruto por lote/ciclo** (reemplaza `girasol` + `informe` + gráfico): costo de insumos, laboreo, cosecha, ingreso bruto, comercialización, flete, arrendamiento y margen. Se muestra en USD totales, USD/ha y **tn de grano/ha**. Tiene gráfico de barras.
2. **Costos por campo / por campaña**: suma por lote, por ha, por tipo de insumo.
3. **Consumo de insumos**: cuánto de cada producto se usó (cantidades totales), útil para compras.
4. Exportar a PDF o Excel.

### 4.10 Configuración
- Precio del gasoil (ARS/L) y **tipo de cambio**, con fecha.
- % de gastos de comercialización por defecto; tarifa de flete por defecto.
- Listas: aportes, cultivos, contratistas, proveedores.
- Cambio de PIN.

### Navegación sugerida
Barra inferior en el celular: **Inicio · Lotes · [+] Registrar · Historial · Más** (Insumos, Labores, Informes, Configuración).

## 5. Impacto en el esquema (`src/db/schema.ts`)

> **Aplicado el 2026-10-01** en las migraciones `0003_ajustes_excel` y `0004_labores_tipo_catalogo` (tabla `tipos_labor`, `aportes`, `cotizaciones`, `configuracion`; columnas nuevas en `lotes`, `ciclos` y `labores`).

En general el esquema ya iba en la dirección correcta (ciclo, labor + labor_insumos, precios con fecha, snapshot). Ajustes que sugiere el Excel:

- `unidad` (enum `L | kg | u`): faltan **tn, bolsa, pack, dosis**.
- `tipo_labor` es un enum: conviene que sea una **tabla catálogo** con la tarifa (litros de gasoil/ha o USD/ha) porque el cliente tiene ~16 labores propias y cambian.
- `categoria_producto`: revisar que estén adherente, fert. foliar, inoculante y semilla.
- `lotes`: agregar **código corto** opcional.
- `labores`: agregar **aporte** (quién paga). Hoy la labor apunta a un ciclo, lo que está bien.
- **Comercialización del ciclo**: precio pizarra, arrendamiento, % gastos, flete, bonificación (en `ciclos` o en una tabla `cosechas`).
- **Parámetros**: precio del gasoil y tipo de cambio con fecha.

## 6. Migración de datos

Se puede importar casi todo:
1. `LOTES` → campos (9) + lotes (31). Cada lote recibe un ciclo de la campaña 2024/25 con el cultivo de la columna (TRIGO/SOJA → dos ciclos).
2. `INSUMOS` → productos (descartando "ninguno" y los de relleno, a confirmar) con su precio actual.
3. `LABORES` → catálogo de labores con litros/ha.
4. `APORTE` → lista de aportes.
5. `BASE DE DATOS` → agrupar filas por **lote + fecha** y armar una labor con N productos. La fila con labor y producto "ninguno" da el tipo y el costo de la labor. Las filas sin labor toman la labor del grupo; si no hay, queda como "Aplicación".

## 7. Preguntas para el cliente (sumar al relevamiento)

1. ¿Qué es exactamente "APORTE"? ¿Proveedor, socio que paga, dueño del campo?
2. Arrendamiento: ¿es % de la producción, tn/ha fijas, o depende del campo?
3. ¿Qué es la "bonificación 15%" del informe?
4. ¿Los precios de los insumos siempre en USD? ¿De dónde saca el tipo de cambio?
5. ¿Las labores siempre las cotiza en litros de gasoil? ¿Las hace él (maquinaria propia) o contratistas?
6. Flete: ¿tarifa por tn, por km (el "180 km" anotado)?
7. Revisar unidades dudosas (CLETODIN 36% en KG, PARAQUAT en KG, HALOXIFOP en KG) y los ítems de relleno (semillas 1..6).
8. ¿Le sirve el margen expresado en **tn de grano/ha**? (lo usa en el informe)
9. ¿Necesita cargar labores **planificadas** (recetas) o solo lo que ya se hizo?
