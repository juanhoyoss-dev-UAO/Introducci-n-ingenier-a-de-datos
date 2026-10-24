import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import type { SnapshotBundle } from "@/contracts/schemas/data";
import { readSnapshotBundle } from "@/server/storage/files";

export const SNAPSHOT_A = "10000000-0000-4000-8000-000000000001";
export const SNAPSHOT_B = "10000000-0000-4000-8000-000000000002";
export const PROJECT_DEMO_ROOT = path.resolve(
  process.cwd(),
  "data",
  "demo",
  "snapshots",
);

export interface TempDataRoots {
  root: string;
  demoRoot: string;
  runtimeRoot: string;
  cleanup(): Promise<void>;
}

export async function createTempDataRoots(): Promise<TempDataRoots> {
  const testRoot = path.resolve(process.cwd(), "data", "runtime", ".tests");
  await mkdir(testRoot, { recursive: true });
  const root = await mkdtemp(path.join(testRoot, "redes-ayuda-csv-"));
  const demoRoot = path.join(root, "demo", "snapshots");
  const runtimeRoot = path.join(root, "runtime");
  await mkdir(demoRoot, { recursive: true });

  return {
    root,
    demoRoot,
    runtimeRoot,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function copyDemoSnapshot(
  snapshotId: string,
  destinationRoot: string,
) {
  await mkdir(destinationRoot, { recursive: true });
  await cp(
    path.join(PROJECT_DEMO_ROOT, snapshotId),
    path.join(destinationRoot, snapshotId),
    { recursive: true, errorOnExist: true, force: false },
  );
}

export async function loadDemoBundle(snapshotId = SNAPSHOT_A) {
  return readSnapshotBundle(
    path.join(PROJECT_DEMO_ROOT, snapshotId),
    snapshotId,
  );
}

export function reidentifyBundle(
  source: SnapshotBundle,
  snapshotId: string,
): SnapshotBundle {
  const bundle = structuredClone(source);
  bundle.metadata.id = snapshotId;
  bundle.metadata.nombre = `Snapshot temporal ${snapshotId.slice(-4)}`;

  for (const collection of [
    bundle.centers,
    bundle.products,
    bundle.presentations,
    bundle.inventory,
    bundle.needs,
    bundle.volunteers,
    bundle.travelTimes,
    bundle.expectedDonations,
  ]) {
    for (const row of collection) {
      row.snapshot_id = snapshotId;
    }
  }

  return bundle;
}
