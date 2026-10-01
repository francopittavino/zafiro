"""
Convierte la planilla anterior del cliente (.xlsm) en datos de prueba para el modo demo.

Uso:  python scripts/importar-planilla.py "Anterior excel zafiro.xlsm"
Salida: datos-demo/zafiro.json (ignorado por git: tiene datos reales del cliente).
Requiere: pip install openpyxl

Ver docs/ANALISIS_EXCEL_ANTERIOR.md para el significado de cada hoja.
"""
import json
import sys
from collections import OrderedDict
from pathlib import Path

import openpyxl

ORIGEN = Path(sys.argv[1] if len(sys.argv) > 1 else "Anterior excel zafiro.xlsm")
DESTINO = Path("datos-demo/zafiro.json")

UNIDADES = {"LTS": "L", "KG": "kg", "TN": "tn", "BLS": "bolsa", "PACK": "pack", "DOSIS": "dosis"}
CATEGORIAS = {
    "HERBICIDA": "herbicida",
    "INSECTICIDA": "insecticida",
    "FUNGUICIDA": "fungicida",
    "ADHERENTE": "coadyuvante",
    "FERTILIZANTE": "fertilizante",
    "FERT FOLIAR": "fertilizante_foliar",
    "INOCULANTE": "inoculante",
    "SEMILLA": "semilla",
    "OTRO": "otro",
}
# Categoría de cada labor de la planilla (para separar la cosecha en el margen bruto).
CATEGORIA_LABOR = {
    "PULVERIZACION": "pulverizacion",
    "DRON": "pulverizacion",
    "AVION": "pulverizacion",
    "FERTIZACION": "fertilizacion",
    "FERTILIZACION": "fertilizacion",
    "FERTILIZACION INVESTA": "fertilizacion",
    "SIEMBRA FINA": "siembra",
    "SIEMBRA GRUESA": "siembra",
    "COSECHA PROPIA": "cosecha",
    "COSECHA DE TERCEROS": "cosecha",
}


def limpio(valor):
    return " ".join(str(valor).split()) if valor is not None else ""


# La planilla está en mayúsculas sin tildes.
TILDES = {
    "Pulverizacion": "Pulverización",
    "Fertilizacion": "Fertilización",
    "Fertizacion": "Fertilización",
    "Avion": "Avión",
    "Rastron": "Rastrón",
    "Paraiso": "Paraíso",
    "Cristobal": "Cristóbal",
    "Raices": "Raíces",
    "Policia": "Policía",
    "Propìo": "Propio",
}


def titulo(texto):
    """'ESTANCIA SANTA MARTA' -> 'Estancia Santa Marta' (respeta siglas cortas como SRL)."""
    def palabra(p):
        if p in {"SRL", "CL", "AX", "SA"}:
            return p
        return "/".join(TILDES.get(x.capitalize(), x.capitalize()) for x in p.split("/"))

    return " ".join(palabra(p) for p in limpio(texto).split())


def numero(valor):
    try:
        return round(float(valor), 4)
    except (TypeError, ValueError):
        return None


libro = openpyxl.load_workbook(ORIGEN, data_only=True)

# ── Cotización usada en la hoja LABORES ──
hoja_labores = libro["LABORES "]
precio_gasoil = numero(hoja_labores["C2"].value) or 0
tipo_cambio = numero(hoja_labores["E2"].value) or 1

# ── Campos y lotes ──
campos, lotes, lote_por_codigo = OrderedDict(), [], {}
for fila in libro["LOTES"].iter_rows(min_row=4, max_row=60, values_only=True):
    codigo_completo, campo, nombre, ha, cultivo = fila[:5]
    if not codigo_completo or not campo:
        continue
    campo = titulo(campo)
    if campo not in campos:
        campos[campo] = {"id": len(campos) + 1, "nombre": campo}
    partes = limpio(codigo_completo).split(" ")
    # El código es la primera palabra (y la segunda si es un número suelto: "SM 1", "LG 1").
    codigo = partes[0] + (" " + partes[1] if len(partes) > 1 and partes[1].isdigit() else "")
    lote = {
        "id": len(lotes) + 1,
        "campoId": campos[campo]["id"],
        "codigo": codigo,
        "nombre": titulo(nombre),
        "ha": numero(ha),
        "cultivo": titulo(cultivo),
    }
    lotes.append(lote)
    lote_por_codigo[limpio(codigo_completo)] = lote

# ── Productos ──
productos, producto_por_nombre = [], {}
for fila in libro["INSUMOS"].iter_rows(min_row=2, max_row=200, values_only=True):
    nombre, unidad, tipo, precio = fila[:4]
    if not nombre or limpio(nombre).lower() == "ninguno":
        continue
    producto = {
        "id": len(productos) + 1,
        "nombre": titulo(nombre),
        "categoria": CATEGORIAS.get(limpio(tipo).upper(), "otro"),
        "unidad": UNIDADES.get(limpio(unidad).upper(), "u"),
        "precio": numero(precio) or 0,
    }
    productos.append(producto)
    producto_por_nombre[limpio(nombre)] = producto

# ── Tipos de labor ──
tipos_labor, tipo_por_nombre = [], {}
for fila in hoja_labores.iter_rows(min_row=4, max_row=40, values_only=True):
    nombre, litros, costo = fila[:3]
    if not nombre or not isinstance(nombre, str):
        continue
    clave = limpio(nombre).upper()
    tipo = {
        "id": len(tipos_labor) + 1,
        "nombre": titulo(nombre),
        "categoria": CATEGORIA_LABOR.get(clave, "laboreo" if "RASTR" in clave else "otra"),
        # La cosecha propia figura con un costo fijo en USD/ha; el resto, en litros de gasoil.
        "cotizacion": "usd_fijo" if clave == "COSECHA PROPIA" else "litros_gasoil",
        "litrosGasoilHa": None if clave == "COSECHA PROPIA" else numero(litros),
        "costoUsdHa": numero(costo) if clave == "COSECHA PROPIA" else None,
    }
    # "FERTILIZACION" está repetida (y "FERTIZACION" es la misma con un error de tipeo).
    repetido = next((t for t in tipos_labor if t["nombre"] == tipo["nombre"]), None)
    if repetido:
        tipo_por_nombre[clave] = repetido
        continue
    tipos_labor.append(tipo)
    tipo_por_nombre[clave] = tipo

aportes = [titulo(f[0]) for f in libro["APORTE"].iter_rows(min_row=3, max_row=20, values_only=True) if f[0]]

# ── Labores: se agrupan las filas por lote + fecha (+ labor) ──
labores, cosechas = OrderedDict(), []
for fila in libro["BASE DE DATOS "].iter_rows(min_row=6, max_row=500, values_only=True):
    lote = lote_por_codigo.get(limpio(fila[0]))
    if not lote or not fila[3]:
        continue
    fecha = fila[3].date().isoformat()
    labor_nombre = limpio(fila[4]).upper() if fila[4] not in (None, 0) else ""
    producto = producto_por_nombre.get(limpio(fila[6]))

    if fila[12]:  # fila de cosecha y comercialización
        cosechas.append({
            "loteId": lote["id"],
            "fecha": fecha,
            "rindeKgHa": numero(fila[12]),
            "arrendamientoPorcentaje": numero(fila[13]),
            "precioPizarra": numero(fila[17]),
            "gastosComercializacionPorcentaje": 0.05,
            "fleteUsdTn": 27,
        })
        if not producto and not labor_nombre:
            continue

    clave = (lote["id"], fecha)
    labor = labores.get(clave)
    if labor is None:
        labor = labores[clave] = {
            "loteId": lote["id"],
            "fecha": fecha,
            "tipoLaborId": None,
            "ha": numero(fila[1]) or lote["ha"],
            "costoLaborHa": 0,
            "aporte": titulo(fila[11]) if fila[11] else None,
            "insumos": [],
        }
    if labor_nombre and labor["tipoLaborId"] is None:
        tipo = tipo_por_nombre.get(labor_nombre)
        labor["tipoLaborId"] = tipo["id"] if tipo else None
        labor["costoLaborHa"] = numero(fila[5]) or 0
    if producto and numero(fila[7]):
        labor["insumos"].append({
            "productoId": producto["id"],
            "dosis": numero(fila[7]),
            "precio": numero(fila[8]) or 0,  # snapshot del precio guardado en la planilla
        })

lista_labores = []
for i, labor in enumerate(sorted(labores.values(), key=lambda l: l["fecha"], reverse=True), start=1):
    lista_labores.append({"id": i, **labor})

DESTINO.parent.mkdir(exist_ok=True)
DESTINO.write_text(
    json.dumps(
        {
            "campania": "2024/25",
            "cotizacion": {"tipoCambio": tipo_cambio, "precioGasoil": precio_gasoil},
            "campos": list(campos.values()),
            "lotes": lotes,
            "productos": productos,
            "tiposLabor": tipos_labor,
            "aportes": aportes,
            "labores": lista_labores,
            "cosechas": cosechas,
        },
        ensure_ascii=False,
        indent=1,
    ),
    encoding="utf-8",
)
print(f"{DESTINO}: {len(campos)} campos, {len(lotes)} lotes, {len(productos)} productos, "
      f"{len(tipos_labor)} labores tipo, {len(lista_labores)} labores, {len(cosechas)} cosechas")
