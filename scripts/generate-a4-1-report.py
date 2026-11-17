from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
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
OUTPUT = ROOT / "output" / "pdf" / "RESUMEN_EJECUCION_A4_1.pdf"

NAVY = colors.HexColor("#0F2942")
TEAL = colors.HexColor("#0F6B78")
PALE = colors.HexColor("#EAF4F5")
SLATE = colors.HexColor("#475569")
LINE = colors.HexColor("#CBD5E1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="A4Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, alignment=TA_CENTER, spaceAfter=3 * mm))
styles.add(ParagraphStyle(name="A4Subtitle", parent=styles["Normal"], fontSize=9.5, leading=13, textColor=SLATE, alignment=TA_CENTER, spaceAfter=5 * mm))
styles.add(ParagraphStyle(name="A4Heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=TEAL, spaceBefore=2.5 * mm, spaceAfter=1.5 * mm))
styles.add(ParagraphStyle(name="A4Body", parent=styles["BodyText"], fontSize=8.5, leading=11.5, textColor=NAVY, spaceAfter=1.2 * mm))
styles.add(ParagraphStyle(name="A4Small", parent=styles["BodyText"], fontSize=7.3, leading=9.5, textColor=NAVY))
styles.add(ParagraphStyle(name="A4TableHeader", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.3, leading=9.5, textColor=colors.white))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(SLATE)
    canvas.drawString(18 * mm, 9 * mm, "Redes de Ayuda - A4.1 - 16 de noviembre de 2026")
    canvas.drawRightString(192 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def bullet(text):
    return Paragraph(f"- {text}", styles["A4Body"])


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=17 * mm,
    bottomMargin=20 * mm,
    title="Resumen de ejecucion A4.1 - Redes de Ayuda",
    author="Codex",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="a4", frames=[frame], onPage=footer)])

story = [
    Paragraph("Resumen de ejecucion A4.1", styles["A4Title"]),
    Paragraph("Centro de gestion de alertas - agrupacion visual", styles["A4Subtitle"]),
    Paragraph("Resultado", styles["A4Heading"]),
    bullet("La lista inicial fue sustituida por cuatro grupos cerrados: Agua y alimentos, Abrigo e higiene, Herramientas y apoyo, y Otras alertas operativas."),
    bullet("Cada grupo muestra alertas activas, criticas, centros afectados y gravedad maxima; las tarjetas solo se renderizan al desplegarlo."),
    bullet("Los grupos se ordenan por severidad maxima y luego por volumen. Los filtros de centro, severidad y tipo se conservan sin cerrar grupos abiertos."),
    bullet("Los excedentes aparecen como oportunidades de abastecimiento. MAIN, PRUEBAS, el importador A3, los contratos y el motor de alertas no fueron modificados."),
    Paragraph("Clasificacion", styles["A4Heading"]),
]

classification = [
    ["Grupo", "Categorias M6.5", "Productos"],
    ["Agua y alimentos", "Agua; Alimentos no perecederos", "P01-P08"],
    ["Abrigo e higiene", "Higiene y saneamiento; Abrigo y alojamiento", "P09-P16"],
    ["Herramientas y apoyo", "Primeros auxilios y proteccion; Herramientas manuales; Herramientas electricas; Energia y comunicacion", "P17-P32"],
    ["Otras alertas", "Voluntariado, donaciones, informacion y capacidad", "No aplica"],
]
table = Table(
    [
        [
            Paragraph(str(cell), styles["A4TableHeader"] if row_index == 0 else styles["A4Small"])
            for cell in row
        ]
        for row_index, row in enumerate(classification)
    ],
    colWidths=[38 * mm, 101 * mm, 28 * mm],
    repeatRows=1,
)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.extend([
    table,
    Spacer(1, 2 * mm),
    Paragraph("Archivos y decisiones", styles["A4Heading"]),
])

files = [
    ["Archivo", "Cambio y verificacion"],
    ["src/app/dashboard/alert-groups.ts", "Mapeo explicito de 32 productos y ocho categorias; agrupacion unica, conteos y orden estable."],
    ["src/app/dashboard/components/alert-center.tsx", "Acordeones accesibles, cerrados al inicio, filtros conservados, tarjetas bajo demanda y etiqueta de oportunidad."],
    ["tests/unit/alert-groups.test.ts", "Cobertura P01-P32, clasificacion, ausencia de duplicados, conteos y orden."],
    ["tests/unit/alert-center.test.tsx", "Render inicial de cuatro grupos cerrados sin tarjetas individuales."],
    ["docs/ESTADO.md; docs/BITACORA.md", "Checkpoint, decisiones, resultados reales y limites del microbloque."],
]
files_table = Table(
    [
        [
            Paragraph(str(cell), styles["A4TableHeader"] if row_index == 0 else styles["A4Small"])
            for cell in row
        ]
        for row_index, row in enumerate(files)
    ],
    colWidths=[62 * mm, 105 * mm],
    repeatRows=1,
)
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
    Paragraph("Verificaciones reales", styles["A4Heading"]),
    bullet("Pruebas unitarias completas: 11 archivos y 78/78 casos aprobados."),
    bullet("Prueba dirigida de agrupacion, render inicial y motor: 3 archivos y 25/25 casos aprobados."),
    bullet("Lint y typecheck aprobados. HTTP y build no se ejecutaron porque no cambiaron rutas, backend ni contratos."),
    bullet("No se realizo verificacion interactiva de navegador en esta ejecucion."),
    Paragraph("Pendientes", styles["A4Heading"]),
    bullet("A4.2: resolucion individual. A4.3: Excel por categoria y plantillas. A4.4: resumen de efectos y cierre de pruebas."),
    bullet("No se hicieron commit, push, merge ni rebase. No se inicio M7."),
])

doc.build(story)
print(OUTPUT)
