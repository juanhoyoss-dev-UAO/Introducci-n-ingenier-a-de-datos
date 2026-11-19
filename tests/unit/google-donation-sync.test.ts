import { describe, expect, it } from "vitest";

import { parseGoogleDonationSheetRows } from "@/server/services/google-donation-sync";

const headers = [
  "ID de respuesta",
  "Marca temporal",
  "Centro de acopio",
  "Producto y presentación",
  "Cantidad anunciada en paquetes",
  "Fecha estimada de entrega",
  "Nombre o entidad donante (opcional)",
  "Observaciones (opcional)",
];

const multiProductHeaders = [
  "ID de respuesta",
  "ID de donación",
  "ID del artículo",
  "Marca temporal",
  "Centro de acopio",
  "Producto y presentación",
  "Cantidad anunciada en paquetes",
  "Fecha estimada de entrega",
  "Nombre o entidad donante (opcional)",
  "Observaciones (opcional)",
];

describe("traducción de respuestas de Google Forms", () => {
  it("convierte una fila válida sin incorporar la donación al inventario", () => {
    const result = parseGoogleDonationSheetRows([
      headers,
      [
        "response-001",
        "18/11/2026 09:30:15",
        "C01 — Centro Norte",
        "AGUA-600 — Botella de 600 ml",
        "20",
        "20/11/2026",
        "Fundación de prueba",
        "Entrega en la mañana",
      ],
    ]);

    expect(result).toMatchObject({
      dataRowCount: 1,
      invalidRows: [],
    });
    expect(result.donations).toHaveLength(1);
    expect(result.donations[0]).toMatchObject({
      rowNumbers: [2],
      operation: {
        operation: "create_donation",
        values: {
          respuesta_origen_id: "forms:response-001",
          centro_id: "C01",
          llegada_estimada: "2026-11-20T12:00:00-05:00",
          registrado_en: "2026-11-18T09:30:15-05:00",
          donante_referencia: "Fundación de prueba",
          observaciones: "Entrega en la mañana",
          fuente: "google_forms",
          articulos: [
            {
              item_origen_id: "item:1",
              producto_id: "PENDIENTE_CATALOGO",
              sku_id: "AGUA-600",
              cantidad_anunciada_paquetes: 20,
            },
          ],
        },
      },
    });
  });

  it("aísla filas inválidas y continúa con las respuestas restantes", () => {
    const result = parseGoogleDonationSheetRows([
      headers,
      [
        "response-invalid",
        "18/11/2026 09:30:15",
        "C01 — Centro Norte",
        "AGUA-600 — Botella de 600 ml",
        "1.5",
        "20/11/2026",
        "",
        "",
      ],
      [
        "response-002",
        "18/11/2026 10:00:00",
        "C02 — Centro Sur",
        "ARROZ-1000 — Bolsa de 1 kg",
        "3",
        "21/11/2026",
        "",
        "",
      ],
    ]);

    expect(result.dataRowCount).toBe(2);
    expect(result.donations).toHaveLength(1);
    expect(result.invalidRows).toEqual([
      { fila: 2, mensaje: "La cantidad debe ser un número entero positivo." },
    ]);
  });

  it("agrupa tres artículos de una misma respuesta y conserva identidades estables", () => {
    const result = parseGoogleDonationSheetRows([
      multiProductHeaders,
      ["response-multi", "response-multi", "response-multi:item:1", "18/11/2026 11:00:00", "C01 — Centro Norte", "AGUA-600 — Botella", "20", "21/11/2026", "Donante múltiple", "Entrega conjunta"],
      ["response-multi", "response-multi", "response-multi:item:2", "18/11/2026 11:00:00", "C01 — Centro Norte", "ARROZ-1000 — Bolsa", "15", "21/11/2026", "Donante múltiple", "Entrega conjunta"],
      ["response-multi", "response-multi", "response-multi:item:3", "18/11/2026 11:00:00", "C01 — Centro Norte", "KIT-ASEO — Kit", "10", "21/11/2026", "Donante múltiple", "Entrega conjunta"],
    ]);

    expect(result).toMatchObject({ dataRowCount: 3, invalidRows: [] });
    expect(result.donations).toHaveLength(1);
    expect(result.donations[0].rowNumbers).toEqual([2, 3, 4]);
    expect(result.donations[0].operation.values.articulos).toEqual([
      expect.objectContaining({ item_origen_id: "item:1", sku_id: "AGUA-600", cantidad_anunciada_paquetes: 20 }),
      expect.objectContaining({ item_origen_id: "item:2", sku_id: "ARROZ-1000", cantidad_anunciada_paquetes: 15 }),
      expect.objectContaining({ item_origen_id: "item:3", sku_id: "KIT-ASEO", cantidad_anunciada_paquetes: 10 }),
    ]);
  });

  it("rechaza completa una donación cuando un artículo no tiene producto o cantidad", () => {
    const result = parseGoogleDonationSheetRows([
      multiProductHeaders,
      ["response-incomplete", "response-incomplete", "response-incomplete:item:1", "18/11/2026 11:00:00", "C01 — Centro Norte", "AGUA-600 — Botella", "20", "21/11/2026", "", ""],
      ["response-incomplete", "response-incomplete", "response-incomplete:item:2", "18/11/2026 11:00:00", "C01 — Centro Norte", "", "5", "21/11/2026", "", ""],
    ]);

    expect(result.donations).toHaveLength(0);
    expect(result.invalidRows).toEqual([
      {
        fila: 3,
        mensaje: "La presentación no contiene un identificador válido.",
      },
    ]);
  });

  it("rechaza una hoja que no exponga la identidad estable de la respuesta", () => {
    expect(() =>
      parseGoogleDonationSheetRows([
        headers.slice(1),
        [
          "18/11/2026 09:30:15",
          "C01 — Centro Norte",
          "AGUA-600 — Botella de 600 ml",
          "20",
          "20/11/2026",
          "",
          "",
        ],
      ]),
    ).toThrowError(expect.objectContaining({ code: "GOOGLE_SHEETS_HEADERS_INVALID" }));
  });
});
