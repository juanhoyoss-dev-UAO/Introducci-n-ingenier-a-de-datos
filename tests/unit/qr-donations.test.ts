import { describe, expect, it } from "vitest";

import {
  qrDonationCsvRowSchema,
  qrDonationOperationSchema,
} from "@/contracts/schemas/qr-donations";
import { qrDonationGeneralStatus } from "@/server/services/qr-donations";

const row = {
  snapshot_id: "f2000000-0000-4000-8000-000000000100",
  anuncio_id: "f2000000-0000-4000-8000-000000000101",
  respuesta_origen_id: "google-response-001",
  centro_id: "C01",
  producto_id: "P01",
  sku_id: "AGUA-600",
  cantidad_anunciada_paquetes: 20,
  cantidad_recibida_paquetes: 8,
  cantidad_pendiente_paquetes: 12,
  llegada_estimada: "2026-11-20T10:00:00-05:00",
  registrado_en: "2026-11-18T09:00:00-05:00",
  donante_referencia: null,
  observaciones: null,
  estado: "parcialmente_recibido",
  fuente: "google_forms",
} as const;

describe("contrato de donaciones QR", () => {
  it("acepta un saldo coherente y conserva identificadores de catálogo", () => {
    expect(qrDonationCsvRowSchema.parse(row)).toMatchObject(row);
  });

  it("rechaza saldos y estados incoherentes", () => {
    expect(
      qrDonationCsvRowSchema.safeParse({
        ...row,
        cantidad_pendiente_paquetes: 13,
      }).success,
    ).toBe(false);
    expect(
      qrDonationCsvRowSchema.safeParse({
        ...row,
        estado: "recibido_completo",
      }).success,
    ).toBe(false);
  });

  it("exige paquetes enteros positivos y un cuerpo estricto", () => {
    const valid = {
      operation: "create_announcement",
      values: {
        operacion_id: "f2000000-0000-4000-8000-000000000102",
        respuesta_origen_id: "google-response-002",
        centro_id: "C01",
        producto_id: "P01",
        sku_id: "AGUA-600",
        cantidad_anunciada_paquetes: 20,
        llegada_estimada: "2026-11-20T10:00:00-05:00",
        registrado_en: "2026-11-18T09:00:00-05:00",
        donante_referencia: null,
        observaciones: null,
        fuente: "google_forms",
      },
    } as const;
    expect(qrDonationOperationSchema.safeParse(valid).success).toBe(true);
    expect(
      qrDonationOperationSchema.safeParse({
        ...valid,
        values: { ...valid.values, cantidad_anunciada_paquetes: 1.5 },
      }).success,
    ).toBe(false);
    expect(
      qrDonationOperationSchema.safeParse({
        ...valid,
        values: { ...valid.values, campo_inesperado: true },
      }).success,
    ).toBe(false);
  });

  it("acepta entre uno y cinco artículos de productos diferentes", () => {
    const valid = {
      operation: "create_donation",
      values: {
        operacion_id: "f2000000-0000-4000-8000-000000000120",
        respuesta_origen_id: "forms:multi-001",
        centro_id: "C01",
        llegada_estimada: "2026-11-20T10:00:00-05:00",
        registrado_en: "2026-11-18T09:00:00-05:00",
        donante_referencia: "Donante múltiple",
        observaciones: null,
        fuente: "google_forms",
        articulos: [
          { item_origen_id: "item:1", producto_id: "P01", sku_id: "AGUA-600", cantidad_anunciada_paquetes: 20 },
          { item_origen_id: "item:2", producto_id: "P02", sku_id: "ARROZ-1000", cantidad_anunciada_paquetes: 15 },
          { item_origen_id: "item:3", producto_id: "P03", sku_id: "FILTRO-PORT", cantidad_anunciada_paquetes: 10 },
        ],
      },
    } as const;
    expect(qrDonationOperationSchema.safeParse(valid).success).toBe(true);
    expect(
      qrDonationOperationSchema.safeParse({
        ...valid,
        values: {
          ...valid.values,
          articulos: [valid.values.articulos[0], { ...valid.values.articulos[1], producto_id: "P01" }],
        },
      }).success,
    ).toBe(false);
  });

  it("calcula el estado general desde los estados de sus artículos", () => {
    expect(
      qrDonationGeneralStatus([
        { estado: "recibido_completo", cantidad_recibida_paquetes: 20, cantidad_pendiente_paquetes: 0 },
        { estado: "parcialmente_recibido", cantidad_recibida_paquetes: 5, cantidad_pendiente_paquetes: 10 },
        { estado: "anunciado", cantidad_recibida_paquetes: 0, cantidad_pendiente_paquetes: 10 },
      ]),
    ).toBe("parcialmente_recibido");
  });
});
