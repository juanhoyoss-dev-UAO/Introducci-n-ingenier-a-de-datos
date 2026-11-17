import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = process.argv[2];
const renderRoot = process.argv[3];
if (!projectRoot || !renderRoot) throw new Error("Se requieren projectRoot y renderRoot.");
const outputDir = path.join(projectRoot, "data", "demo", "a3");
const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "manifest.json"), "utf8"));
await fs.mkdir(renderRoot, { recursive: true });

const headers = ["operacion_id", "recibido_en", "centro_id", "sku_id", "cantidad_paquetes"];

function styleReceptionSheet(sheet, rowCount) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A1:E1").format = {
    fill: "#0F4C5C",
    font: { name: "Arial", bold: true, color: "#FFFFFF", size: 11 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:E${Math.max(2, rowCount + 1)}`).format.font = { name: "Arial", size: 10 };
  sheet.getRange(`A1:E${Math.max(2, rowCount + 1)}`).format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
  sheet.getRange("A:A").format.columnWidth = 39;
  sheet.getRange("B:B").format.columnWidth = 30;
  sheet.getRange("C:C").format.columnWidth = 14;
  sheet.getRange("D:D").format.columnWidth = 27;
  sheet.getRange("E:E").format.columnWidth = 20;
  sheet.getRange(`B2:B${Math.max(2, rowCount + 1)}`).format.numberFormat = "@";
  sheet.getRange(`E2:E${Math.max(2, rowCount + 1)}`).format.numberFormat = "0";
}

async function buildWorkbook(fileName, rows, includeInstructions = false) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Recepciones");
  sheet.getRange("A1:E1").values = [headers];
  if (rows.length > 0) {
    sheet.getRange(`A2:E${rows.length + 1}`).values = rows.map((row) => [
      row.operacion_id,
      `${row.recibido_en} `,
      row.centro_id,
      row.sku_id,
      row.cantidad_paquetes,
    ]);
  }
  styleReceptionSheet(sheet, rows.length);

  if (includeInstructions) {
    const instructions = workbook.worksheets.add("Instrucciones");
    instructions.showGridLines = false;
    instructions.getRange("A1:B1").values = [["PLANTILLA DE RECEPCIONES CONFIRMADAS", "America/Bogota"]];
    instructions.getRange("A1:B1").format = { fill: "#0F4C5C", font: { name: "Arial", bold: true, color: "#FFFFFF", size: 12 } };
    instructions.getRange("A3:B9").values = [
      ["Campo", "Regla"],
      ["operacion_id", "UUID único; no reutilizarlo en otro archivo."],
      ["recibido_en", "Texto ISO 8601 con offset -05:00, por ejemplo 2026-11-16T08:00:00-05:00."],
      ["centro_id", "Centro existente del escenario PRUEBAS."],
      ["sku_id", "Presentación existente en el catálogo del escenario."],
      ["cantidad_paquetes", "Número entero positivo; representa una entrada nueva, no el inventario total."],
      ["Importación", "Solo se procesa la hoja Recepciones y las cinco columnas exactas. Todas las filas se guardan juntas o ninguna."],
    ];
    instructions.getRange("A3:B3").format = { fill: "#DDEBF1", font: { name: "Arial", bold: true, color: "#0F172A" } };
    instructions.getRange("A1:B9").format.font = { name: "Arial", size: 10 };
    instructions.getRange("A1:B9").format.wrapText = true;
    instructions.getRange("A:A").format.columnWidth = 24;
    instructions.getRange("B:B").format.columnWidth = 92;
    instructions.getRange("A3:B9").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
  }

  workbook.recalculate();
  for (const sheetName of includeInstructions ? ["Recepciones", "Instrucciones"] : ["Recepciones"]) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(renderRoot, `${path.basename(fileName, ".xlsx")}-${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
  }
  const outputPath = path.join(outputDir, fileName);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputPath);

  const imported = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
  const region = await imported.inspect({ kind: "region", sheetId: "Recepciones", range: `A1:E${Math.max(2, rows.length + 1)}`, maxChars: 3000 });
  const errors = await imported.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 20 }, maxChars: 2000 });
  await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });
  return { fileName, rows: rows.length, region: region.ndjson, errors: errors.ndjson };
}

const checks = [];
checks.push(await buildWorkbook("PLANTILLA_RECEPCIONES.xlsx", [], true));
for (const item of manifest.files) checks.push(await buildWorkbook(item.file, item.rows));
console.log(JSON.stringify(checks.map(({ fileName, rows, errors }) => ({ fileName, rows, errors })), null, 2));
