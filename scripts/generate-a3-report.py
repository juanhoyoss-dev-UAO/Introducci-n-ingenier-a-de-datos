from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "RESUMEN_EJECUCION_A3.pdf"
RESULTS = ROOT / "data" / "demo" / "a3" / "resultados-prueba.json"

NAVY = colors.HexColor("#0F2942")
TEAL = colors.HexColor("#0F6B78")
PALE = colors.HexColor("#EAF4F5")
SLATE = colors.HexColor("#475569")
LINE = colors.HexColor("#CBD5E1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleA3", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, alignment=TA_CENTER, spaceAfter=5 * mm))
styles.add(ParagraphStyle(name="SubtitleA3", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=SLATE, alignment=TA_CENTER, spaceAfter=6 * mm))
styles.add(ParagraphStyle(name="HeadingA3", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=TEAL, spaceBefore=3 * mm, spaceAfter=2 * mm))
styles.add(ParagraphStyle(name="BodyA3", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=NAVY, alignment=TA_LEFT, spaceAfter=1.5 * mm))
styles.add(ParagraphStyle(name="SmallA3", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=NAVY))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(SLATE)
    canvas.drawString(18 * mm, 9 * mm, "Redes de Ayuda - Fase A3 - 16 de noviembre de 2026")
    canvas.drawRightString(192 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def bullet(text):
    return Paragraph(f"- {text}", styles["BodyA3"])


data = json.loads(RESULTS.read_text(encoding="utf-8"))
rows = data["results"]
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=18 * mm, bottomMargin=20 * mm, title="Resumen de ejecucion A3 - Redes de Ayuda", author="Codex")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="a3", frames=[frame], onPage=footer)])

story = [
    Paragraph("Resumen de ejecucion A3", styles["TitleA3"]),
    Paragraph("Importacion Excel y pruebas de resolucion de alertas", styles["SubtitleA3"]),
    Paragraph("Resultado", styles["HeadingA3"]),
    bullet("MAIN quedo protegido como referencia de solo lectura y conserva el cierre M6.5 completo."),
    bullet("PRUEBAS parte del mismo estado final, con movimientos y eventos historicos vacios para evitar duplicar los 352 acontecimientos ya incorporados."),
    bullet("Cada XLSX se previsualiza, valida y publica como un unico lote atomico; una reimportacion valida no vuelve a sumar inventario."),
    bullet("El dashboard compara inventario, cobertura, deficit y alertas antes y despues usando la hora del escenario."),
    Paragraph("Ejecucion secuencial real", styles["HeadingA3"]),
]

table_data = [["Excel", "Centro", "Antes", "Despues", "Res.", "Red."]]
for item in rows:
    table_data.append([
        item["Excel"].replace("RECEPCION_", "R"),
        item["Centro"],
        str(item["Alertas antes"]),
        str(item["Alertas después"]),
        str(item["Resueltas"]),
        str(item["Reducción de severidad"]),
    ])
table = Table(table_data, colWidths=[35 * mm, 38 * mm, 24 * mm, 24 * mm, 18 * mm, 18 * mm], repeatRows=1)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 7.5),
    ("ALIGN", (2, 1), (-1, -1), "CENTER"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.extend([
    table,
    Spacer(1, 3 * mm),
    Paragraph("Totales observados: 10 importaciones aprobadas, 6 alertas resueltas y 8 reducciones de severidad. Los totales entre archivos pueden crecer por el avance del reloj simulado; cada efecto se compara a la misma hora antes y despues.", styles["SmallA3"]),
    Paragraph("Verificaciones", styles["HeadingA3"]),
    bullet("Pruebas unitarias: 73/73 aprobadas."),
    bullet("Integracion dirigida A3, repositorio CSV y escenario semanal: 24/24 aprobadas."),
    bullet("Lint y typecheck: aprobados."),
    bullet("11 libros y 12 hojas: renderizados, inspeccionados visualmente y sin errores de formula."),
    bullet("Navegador A3: no verificado; la ventana disponible correspondia a una instancia anterior."),
    Paragraph("Archivos y decisiones", styles["HeadingA3"]),
])

files_data = [
    ["Grupo", "Archivos principales", "Decision y verificacion"],
    ["Escenarios", "src/lib/operational-scenarios.ts; scripts/generate-testing-scenario.ts; data/demo/snapshots/a300...0002/", "IDs compartidos, copia final sin historiales y trazabilidad a MAIN."],
    ["Importador", "src/server/services/excel-reception-*.ts; excel-upload.ts; rutas /excel-import", "Hoja/columnas exactas, 1 MB, 100 filas, catalogo, enteros, atomicidad e idempotencia."],
    ["Proteccion", "scenario-protection.ts; movement-operations.ts; operational-updates.ts", "MAIN rechaza mutaciones existentes y nuevas."],
    ["Interfaz", "excel-reception-importer.tsx; alert-center.tsx; dashboard-client.tsx; view-model.ts", "Previsualizacion, confirmacion, resultado antes/despues, selector MAIN/PRUEBAS y reinicio confirmado."],
    ["Excel", "data/demo/a3/*.xlsx; manifest.json; resultados-prueba.json", "Plantilla y diez lotes reales con fecha 2026-11-16 y offset -05:00."],
    ["Pruebas", "tests/integration/a3-excel-import.test.ts; csv-repository.test.ts; dashboard-view-model.test.ts", "Valida formato, lote multiple, aislamiento, reinicio, alertas e idempotencia."],
    ["Documentacion", "docs/ESTADO.md; docs/BITACORA.md; docs/DEMO_A3.md", "Estado breve, evidencia real e instrucciones manuales."],
]
files_table = Table([[Paragraph(str(cell), styles["SmallA3"]) for cell in row] for row in files_data], colWidths=[25 * mm, 68 * mm, 74 * mm], repeatRows=1)
files_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), TEAL),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.extend([
    files_table,
    Paragraph("Dependencias", styles["HeadingA3"]),
    bullet("read-excel-file 9.3.14: lectura enfocada de XLSX; no ejecuta formulas ni codigo del libro."),
    bullet("vite 7.2.2: dependencia de desarrollo exacta requerida por Vitest 5 para ejecutar el arnes declarado."),
    Paragraph("Pendientes y limites", styles["HeadingA3"]),
    bullet("Completar la demostracion manual autenticada sobre el servidor actualizado siguiendo docs/DEMO_A3.md."),
    bullet("Revisar en un bloque separado las 10 vulnerabilidades informadas por npm audit; no se ejecuto audit fix."),
    bullet("No se implemento M7, no se cambio el Resumen operativo y no se hicieron commit, push, merge ni rebase."),
])

doc.build(story)
print(OUTPUT)
