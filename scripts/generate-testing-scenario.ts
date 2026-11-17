import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAIN_SNAPSHOT_ID = "65000000-0000-4000-8000-000000000003";
const TESTING_SCENARIO_ID = "a3000000-0000-4000-8000-000000000001";
const TESTING_BASE_ID = "a3000000-0000-4000-8000-000000000002";
const snapshotsRoot = path.resolve("data", "demo", "snapshots");
const sourceDirectory = path.join(snapshotsRoot, MAIN_SNAPSHOT_ID);
const destination = path.join(snapshotsRoot, TESTING_BASE_ID);
const stage = path.join(snapshotsRoot, `.a3-${TESTING_BASE_ID}`);

const copiedFiles = [
  "centros.csv",
  "productos.csv",
  "presentaciones.csv",
  "inventario.csv",
  "necesidades.csv",
  "voluntarios.csv",
  "tiempos.csv",
  "intenciones.csv",
] as const;

async function exists(value: string) {
  return stat(value).then(() => true).catch(() => false);
}

async function main() {
  if (await exists(destination)) {
    throw new Error(`El snapshot PRUEBAS ya existe: ${destination}`);
  }
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: false });
  try {
    for (const file of copiedFiles) {
      const source = await readFile(path.join(sourceDirectory, file), "utf8");
      const copied = source.replaceAll(MAIN_SNAPSHOT_ID, TESTING_BASE_ID);
      await writeFile(path.join(stage, file), copied, { encoding: "utf8", flag: "wx" });
    }
    const movementHeader = (await readFile(path.join(sourceDirectory, "movimientos.csv"), "utf8")).split(/\r?\n/, 1)[0];
    const eventHeader = (await readFile(path.join(sourceDirectory, "eventos.csv"), "utf8")).split(/\r?\n/, 1)[0];
    await writeFile(path.join(stage, "movimientos.csv"), `${movementHeader}\n`, { encoding: "utf8", flag: "wx" });
    await writeFile(path.join(stage, "eventos.csv"), `${eventHeader}\n`, { encoding: "utf8", flag: "wx" });
    await writeFile(
      path.join(stage, "metadata.json"),
      `${JSON.stringify({
        id: TESTING_BASE_ID,
        nombre: "Emergencia semanal — PRUEBAS · estado base",
        created_at: "2026-11-16T00:00:00-05:00",
        descripcion: "Copia operativa independiente del cierre M6.5; conserva el estado final y reinicia el historial de la rama de pruebas.",
        escenario_id: TESTING_SCENARIO_ID,
        snapshot_origen_id: MAIN_SNAPSHOT_ID,
        snapshot_base_id: TESTING_BASE_ID,
      }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(stage, destination);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  console.log(`Snapshot PRUEBAS generado en ${destination}`);
}

await main();
