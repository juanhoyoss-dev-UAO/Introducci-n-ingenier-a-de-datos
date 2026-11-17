from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "RESUMEN_EJECUCION_A4_2.pdf"
NAVY = colors.HexColor("#0F2942")
TEAL = colors.HexColor("#0F6B78")
PALE = colors.HexColor("#EAF4F5")
SLATE = colors.HexColor("#475569")
LINE = colors.HexColor("#CBD5E1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="A42Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, alignment=TA_CENTER, spaceAfter=3 * mm))
styles.add(ParagraphStyle(name="A42Subtitle", parent=styles["Normal"], fontSize=9.5, leading=13, textColor=SLATE, alignment=TA_CENTER, spaceAfter=5 * mm))
styles.add(ParagraphStyle(name="A42Heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=TEAL, spaceBefore=2.5 * mm, spaceAfter=1.5 * mm))
styles.add(ParagraphStyle(name="A42Body", parent=styles["BodyText"], fontSize=8.5, leading=11.5, textColor=NAVY, spaceAfter=1.2 * mm))
styles.add(ParagraphStyle(name="A42Small", parent=styles["BodyText"], fontSize=7.3, leading=9.5, textColor=NAVY))
styles.add(ParagraphStyle(name="A42Header", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.3, leading=9.5, textColor=colors.white))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(SLATE)
    canvas.drawString(18 * mm, 9 * mm, "Redes de Ayuda - A4.2 - 16 de noviembre de 2026")
    canvas.drawRightString(192 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def bullet(text):
    return Paragraph(f"- {text}", styles["A42Body"])


def styled_table(rows, widths):
    content = [
        [Paragraph(str(cell), styles["A42Header"] if index == 0 else styles["A42Small"]) for cell in row]
        for index, row in enumerate(rows)
    ]
    table = Table(content, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=17 * mm, bottomMargin=20 * mm, title="Resumen de ejecucion A4.2 - Redes de Ayuda", author="Codex")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="a42", frames=[frame], onPage=footer)])

files = [
    ["Archivo", "Decision y verificacion"],
    ["alert-center.tsx", "Encabezado compacto, boton Solucionar alerta, grupo controlado y resumen real posterior."],
    ["alert-resolution-modal.tsx", "Formulario accesible, hora operativa, presentaciones, enteros positivos, vista previa y envio bloqueado."],
    ["alert-resolution.ts", "Conversion en unidad base, formulas de dominio y comparacion del bundle nuevo."],
    ["dashboard-client.tsx", "Reutiliza direct_reception, selecciona la version publicada y conserva grupo/contexto durante la recarga."],
    ["tests unitarios e integracion A4.2", "Formulario, calculos, clasificacion del efecto, persistencia, MAIN e idempotencia."],
    ["docs/ESTADO.md; docs/BITACORA.md", "Checkpoint breve, evidencia real y pendientes."],
]

story = [
    Paragraph("Resumen de ejecucion A4.2", styles["A42Title"]),
    Paragraph("Resolucion individual de alertas", styles["A42Subtitle"]),
    Paragraph("Resultado", styles["A42Heading"]),
    bullet("La franja oscura fue reemplazada por un titulo compacto con la hora evaluada del escenario."),
    bullet("Cada deficit de producto en PRUEBAS permite registrar una recepcion directa sin abandonar Alertas operativas."),
    bullet("El modal muestra datos actuales, convierte paquetes con el contenido real de la presentacion y limita la fecha a la hora operativa."),
    bullet("El backend M4 publica una version atomica e idempotente; despues de recargar se informa el resultado real y se conserva el grupo abierto."),
    bullet("MAIN permanece en solo lectura. No se modificaron motor de alertas, contratos, importador Excel ni Resumen operativo."),
    Paragraph("Archivos", styles["A42Heading"]),
    styled_table(files, [61 * mm, 106 * mm]),
    Paragraph("Caso real verificado", styles["A42Heading"]),
    bullet("Centro Norte / Extension electrica P27 inicio con 0 de 12 unidades y cobertura 0 %."),
    bullet("Una recepcion parcial de 3 dejo inventario 3, cobertura 25 % y deficit 9; la alerta continuo activa."),
    bullet("Una segunda recepcion de 9 dejo inventario 12, cobertura 100 % y deficit 0; la alerta desaparecio."),
    bullet("Repetir la segunda operacion reutilizo la misma version sin duplicar inventario ni movimientos."),
    Paragraph("Verificaciones", styles["A42Heading"]),
    bullet("Pruebas dirigidas: 6 archivos, 33/33 aprobadas. Lint y typecheck aprobados."),
    bullet("HTTP completo, build y navegador interactivo no se ejecutaron por no ser necesarios para este cambio."),
    Paragraph("Pendientes", styles["A42Heading"]),
    bullet("A4.3 y A4.4 no iniciados. Sin commit, push, merge o rebase."),
]

doc.build(story)
print(OUTPUT)
