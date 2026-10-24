import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CsvOperationsRepository } from "@/server/repositories/operations";
import {
  copyDemoSnapshot,
  createTempDataRoots,
  loadDemoBundle,
  reidentifyBundle,
  SNAPSHOT_A,
} from "../helpers/csv";

const ID_ONE = "40000000-0000-4000-8000-000000000011";
const ID_TWO = "40000000-0000-4000-8000-000000000012";

describe("formato y seguridad CSV", () => {
  it("acepta BOM, comas, comillas, tildes y saltos de línea", async () => {
    const roots = await createTempDataRoots();
    try {
      const bundle = reidentifyBundle(await loadDemoBundle(), ID_ONE);
      bundle.centers[0].nombre = 'Centro "La Esperanza", Norte';
      bundle.centers[0].zona = "Ladera, alta";
      bundle.centers[0].coordinador_nombre = "Ana\nMaría";
      const writer = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      await writer.writeSnapshot(bundle);

      const centersPath = path.join(
        roots.runtimeRoot,
        "snapshots",
        ID_ONE,
        "centros.csv",
      );
      const original = await readFile(centersPath, "utf8");
      await writeFile(centersPath, `\uFEFF${original}`, "utf8");

      const reader = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      const [center] = await reader.listCenters(ID_ONE);
      expect(center).toMatchObject({
        nombre: 'Centro "La Esperanza", Norte',
        zona: "Ladera, alta",
        coordinador_nombre: "Ana\nMaría",
      });
    } finally {
      await roots.cleanup();
    }
  });

  it.each([
    ["identificador duplicado", (bundle: Awaited<ReturnType<typeof loadDemoBundle>>) => {
      bundle.centers.push(structuredClone(bundle.centers[0]));
    }],
    ["referencia inexistente", (bundle: Awaited<ReturnType<typeof loadDemoBundle>>) => {
      bundle.inventory[0].centro_id = "C99";
    }],
  ])("rechaza %s antes de publicar", async (_name, mutate) => {
    const roots = await createTempDataRoots();
    try {
      const bundle = reidentifyBundle(await loadDemoBundle(), ID_ONE);
      mutate(bundle);
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });

      await expect(repository.writeSnapshot(bundle)).rejects.toThrow(/inválido/i);
      await expect(repository.findSnapshot(ID_ONE)).resolves.toBeNull();
    } finally {
      await roots.cleanup();
    }
  });

  it("rechaza traversal y una raíz ubicada dentro de public", async () => {
    const roots = await createTempDataRoots();
    try {
      const sentinelPath = path.join(roots.root, "sentinel.txt");
      await writeFile(sentinelPath, "intacto", "utf8");
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });

      for (const maliciousId of ["../fuera", "..\\fuera", "%2e%2e", "C:\\fuera"]) {
        await expect(repository.findSnapshot(maliciousId)).rejects.toThrow(/UUID/i);
      }
      await expect(readFile(sentinelPath, "utf8")).resolves.toBe("intacto");
      expect(
        () =>
          new CsvOperationsRepository({
            demoRoot: roots.demoRoot,
            runtimeRoot: path.join(process.cwd(), "public", "datos"),
          }),
      ).toThrow(/public/i);
    } finally {
      await roots.cleanup();
    }
  });

  it("un fallo de staging no publica datos ni daña un snapshot existente", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      const first = reidentifyBundle(await loadDemoBundle(), ID_ONE);
      await repository.writeSnapshot(first);

      await rm(path.join(roots.runtimeRoot, ".staging"), {
        recursive: true,
        force: true,
      });
      await writeFile(path.join(roots.runtimeRoot, ".staging"), "bloqueado", "utf8");
      const second = reidentifyBundle(await loadDemoBundle(), ID_TWO);

      await expect(repository.writeSnapshot(second)).rejects.toThrow(/publicar/i);
      await expect(repository.listCenters(ID_ONE)).resolves.toHaveLength(6);
      await expect(repository.findSnapshot(ID_TWO)).resolves.toBeNull();
    } finally {
      await roots.cleanup();
    }
  });

  it("impide sobrescribir un snapshot y conserva sus bytes", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      const first = reidentifyBundle(await loadDemoBundle(), ID_ONE);
      await repository.writeSnapshot(first);
      const centersPath = path.join(
        roots.runtimeRoot,
        "snapshots",
        ID_ONE,
        "centros.csv",
      );
      const before = await readFile(centersPath, "utf8");

      const replacement = structuredClone(first);
      replacement.centers[0].nombre = "Sobrescritura no permitida";
      await expect(repository.writeSnapshot(replacement)).rejects.toThrow(
        /ya existe|sobrescribirá/i,
      );
      await expect(readFile(centersPath, "utf8")).resolves.toBe(before);
    } finally {
      await roots.cleanup();
    }
  });

  it("detecta el mismo UUID en demo y runtime", async () => {
    const roots = await createTempDataRoots();
    try {
      await copyDemoSnapshot(SNAPSHOT_A, roots.demoRoot);
      const runtimeSnapshots = path.join(roots.runtimeRoot, "snapshots");
      await mkdir(runtimeSnapshots, { recursive: true });
      await copyDemoSnapshot(SNAPSHOT_A, runtimeSnapshots);

      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(repository.listSnapshots()).rejects.toThrow(/duplicado/i);
    } finally {
      await roots.cleanup();
    }
  });

  it("rechaza columnas adicionales", async () => {
    const roots = await createTempDataRoots();
    try {
      await copyDemoSnapshot(SNAPSHOT_A, roots.demoRoot);
      const productsPath = path.join(
        roots.demoRoot,
        SNAPSHOT_A,
        "productos.csv",
      );
      const original = await readFile(productsPath, "utf8");
      await writeFile(
        productsPath,
        original.replace(
          "snapshot_id,producto_id,nombre,unidad_base",
          "snapshot_id,producto_id,nombre,unidad_base,columna_extra",
        ),
        "utf8",
      );
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });

      await expect(repository.listProducts(SNAPSHOT_A)).rejects.toThrow(
        /Encabezado CSV inválido/i,
      );
    } finally {
      await roots.cleanup();
    }
  });
});
