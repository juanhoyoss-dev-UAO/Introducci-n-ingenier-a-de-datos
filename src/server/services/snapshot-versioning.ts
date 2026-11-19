import { createHash } from "node:crypto";

import type { SnapshotBundle } from "@/contracts/schemas/data";

export function stableUuid(label: string) {
  const bytes = createHash("sha256").update(label).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function reidentifySnapshot(bundle: SnapshotBundle, snapshotId: string) {
  for (const collection of [
    bundle.centers,
    bundle.products,
    bundle.presentations,
    bundle.inventory,
    bundle.needs,
    bundle.volunteers,
    bundle.travelTimes,
    bundle.expectedDonations,
    bundle.qrDonations,
    bundle.movements,
    bundle.operationalEvents,
  ]) {
    for (const row of collection) {
      row.snapshot_id = snapshotId;
    }
  }
}

export function nextScenarioTimestamp(...timestamps: string[]) {
  const latest = Math.max(...timestamps.map((value) => Date.parse(value)));
  if (!Number.isFinite(latest)) {
    throw new Error("No se pudo determinar la hora operativa del escenario.");
  }
  return new Date(latest).toISOString();
}
