import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  snapshotBundleSchema,
  type SnapshotBundle,
} from "@/contracts/schemas/data";
import { snapshotIdSchema } from "@/contracts/schemas/queries";
import type { SnapshotRecord } from "@/contracts/types/database";
import { RepositoryError } from "@/server/services/errors";
import {
  readSnapshotBundle,
  rejectPublicStorage,
  requireDirectory,
  requireNoSymlinkComponents,
  resolveWithin,
  writeSnapshotBundle,
} from "@/server/storage/files";
import type { DashboardSource, OperationsRepository } from "./types";

export interface CsvOperationsRepositoryOptions {
  demoRoot?: string;
  runtimeRoot?: string;
}

interface SnapshotLocation {
  id: string;
  directory: string;
  source: "demo" | "runtime";
}

async function pathExists(target: string) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function canonicalSnapshotId(value: string) {
  const result = snapshotIdSchema.safeParse(value);
  if (!result.success) {
    throw new RepositoryError("El identificador del snapshot debe ser un UUID válido.");
  }
  return result.data.toLowerCase();
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sortedBy<T>(rows: readonly T[], keyFor: (row: T) => string) {
  return [...rows].sort((left, right) =>
    keyFor(left).localeCompare(keyFor(right)),
  );
}

export class CsvOperationsRepository implements OperationsRepository {
  readonly demoRoot: string;
  readonly runtimeRoot: string;
  readonly runtimeSnapshotsRoot: string;
  readonly runtimeSimulationsRoot: string;
  readonly stagingRoot: string;
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(options: CsvOperationsRepositoryOptions = {}) {
    this.demoRoot = path.resolve(
      options.demoRoot ?? path.join(process.cwd(), "data", "demo", "snapshots"),
    );
    this.runtimeRoot = path.resolve(
      options.runtimeRoot ?? path.join(process.cwd(), "data", "runtime"),
    );
    this.runtimeSnapshotsRoot = resolveWithin(this.runtimeRoot, "snapshots");
    this.runtimeSimulationsRoot = resolveWithin(this.runtimeRoot, "simulations");
    this.stagingRoot = resolveWithin(this.runtimeRoot, ".staging");

    rejectPublicStorage(this.demoRoot);
    rejectPublicStorage(this.runtimeRoot);
  }

  private async listDirectories(
    root: string,
    source: SnapshotLocation["source"],
  ): Promise<SnapshotLocation[]> {
    if (!(await pathExists(root))) {
      return [];
    }
    await requireDirectory(root);

    const entries = await readdir(root, { withFileTypes: true });
    const locations: SnapshotLocation[] = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        throw new RepositoryError(
          `Entrada no permitida en snapshots ${source}: ${entry.name}.`,
        );
      }

      const id = canonicalSnapshotId(entry.name);
      if (entry.name !== id) {
        throw new RepositoryError(
          `El directorio del snapshot debe usar un UUID canónico en minúsculas: ${entry.name}.`,
        );
      }

      const directory = resolveWithin(root, entry.name);
      await requireDirectory(directory);
      locations.push({ id, directory, source });
    }

    return locations;
  }

  private async collectLocations() {
    try {
      const [demo, runtime] = await Promise.all([
        this.listDirectories(this.demoRoot, "demo"),
        this.listDirectories(this.runtimeSnapshotsRoot, "runtime"),
      ]);
      const locations = new Map<string, SnapshotLocation>();

      for (const location of [...demo, ...runtime]) {
        const previous = locations.get(location.id);
        if (previous) {
          throw new RepositoryError(
            `El snapshot ${location.id} está duplicado entre ${previous.source} y ${location.source}.`,
          );
        }
        locations.set(location.id, location);
      }

      return locations;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `No fue posible inspeccionar el almacenamiento CSV: ${describeError(error)}`,
      );
    }
  }

  private async loadSnapshot(snapshotId: string): Promise<SnapshotBundle | null> {
    const id = canonicalSnapshotId(snapshotId);
    const locations = await this.collectLocations();
    const location = locations.get(id);
    if (!location) {
      return null;
    }

    try {
      return await readSnapshotBundle(location.directory, id);
    } catch (error) {
      throw new RepositoryError(
        `El snapshot ${id} contiene datos inválidos: ${describeError(error)}`,
      );
    }
  }

  async listSnapshots(): Promise<SnapshotRecord[]> {
    const locations = await this.collectLocations();
    const bundles = await Promise.all(
      [...locations.values()].map((location) =>
        readSnapshotBundle(location.directory, location.id).catch((error) => {
          throw new RepositoryError(
            `El snapshot ${location.id} contiene datos inválidos: ${describeError(error)}`,
          );
        }),
      ),
    );

    return bundles
      .map((bundle) => bundle.metadata)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async findSnapshot(snapshotId: string) {
    return (await this.loadSnapshot(snapshotId))?.metadata ?? null;
  }

  async listCenters(snapshotId: string) {
    const rows = (await this.loadSnapshot(snapshotId))?.centers ?? [];
    return sortedBy(rows, (row) => row.centro_id);
  }

  async listProducts(snapshotId: string) {
    const rows = (await this.loadSnapshot(snapshotId))?.products ?? [];
    return sortedBy(rows, (row) => row.producto_id);
  }

  async listPresentations(snapshotId: string) {
    const rows = (await this.loadSnapshot(snapshotId))?.presentations ?? [];
    return sortedBy(rows, (row) => row.sku_id);
  }

  async listInventory(snapshotId: string) {
    return (await this.loadSnapshot(snapshotId))?.inventory ?? [];
  }

  async listNeeds(snapshotId: string) {
    return (await this.loadSnapshot(snapshotId))?.needs ?? [];
  }

  async listVolunteers(snapshotId: string) {
    return (await this.loadSnapshot(snapshotId))?.volunteers ?? [];
  }

  async listTravelTimes(snapshotId: string) {
    const rows = (await this.loadSnapshot(snapshotId))?.travelTimes ?? [];
    return [...rows].sort(
      (left, right) =>
        left.origen_id.localeCompare(right.origen_id) ||
        left.destino_id.localeCompare(right.destino_id),
    );
  }

  async listExpectedDonations(snapshotId: string) {
    return (await this.loadSnapshot(snapshotId))?.expectedDonations ?? [];
  }

  async getDashboardSource(snapshotId: string): Promise<DashboardSource> {
    const bundle = await this.loadSnapshot(snapshotId);
    if (!bundle) {
      return {
        snapshot: null,
        centers: [],
        products: [],
        presentations: [],
        inventory: [],
        needs: [],
        volunteers: [],
        travelTimes: [],
        expectedDonations: [],
      };
    }

    return {
      snapshot: bundle.metadata,
      centers: sortedBy(bundle.centers, (row) => row.centro_id),
      products: sortedBy(bundle.products, (row) => row.producto_id),
      presentations: sortedBy(bundle.presentations, (row) => row.sku_id),
      inventory: bundle.inventory,
      needs: bundle.needs,
      volunteers: bundle.volunteers,
      travelTimes: [...bundle.travelTimes].sort(
        (left, right) =>
          left.origen_id.localeCompare(right.origen_id) ||
          left.destino_id.localeCompare(right.destino_id),
      ),
      expectedDonations: bundle.expectedDonations,
    };
  }

  private async withWriteLock<T>(snapshotId: string, action: () => Promise<T>) {
    const previous = this.writeQueues.get(snapshotId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.writeQueues.set(snapshotId, tail);

    await previous.catch(() => undefined);
    try {
      return await action();
    } finally {
      release();
      if (this.writeQueues.get(snapshotId) === tail) {
        this.writeQueues.delete(snapshotId);
      }
    }
  }

  async writeSnapshot(input: unknown): Promise<SnapshotRecord> {
    let bundle: SnapshotBundle;
    try {
      bundle = snapshotBundleSchema.parse(input);
    } catch (error) {
      throw new RepositoryError(
        `No se puede escribir un snapshot inválido: ${describeError(error)}`,
      );
    }

    const id = canonicalSnapshotId(bundle.metadata.id);
    return this.withWriteLock(id, async () => {
      const existing = await this.collectLocations();
      if (existing.has(id)) {
        throw new RepositoryError(`El snapshot ${id} ya existe y no se sobrescribirá.`);
      }

      let stageDirectory: string | null = null;
      let published = false;
      try {
        await requireNoSymlinkComponents(this.runtimeRoot);
        await mkdir(this.runtimeRoot, { recursive: true });
        await requireDirectory(this.runtimeRoot);
        await mkdir(this.runtimeSnapshotsRoot, { recursive: true });
        await requireDirectory(this.runtimeSnapshotsRoot);
        await mkdir(this.runtimeSimulationsRoot, { recursive: true });
        await requireDirectory(this.runtimeSimulationsRoot);
        await mkdir(this.stagingRoot, { recursive: true });
        await requireDirectory(this.stagingRoot);

        stageDirectory = resolveWithin(this.stagingRoot, `${id}-${randomUUID()}`);
        await writeSnapshotBundle(stageDirectory, bundle);
        await readSnapshotBundle(stageDirectory, id);

        const locationsBeforePublish = await this.collectLocations();
        if (locationsBeforePublish.has(id)) {
          throw new RepositoryError(
            `El snapshot ${id} apareció durante la escritura y no se sobrescribirá.`,
          );
        }

        const destination = resolveWithin(this.runtimeSnapshotsRoot, id);
        if (await pathExists(destination)) {
          throw new RepositoryError(`El destino ${id} ya existe.`);
        }

        await rename(stageDirectory, destination);
        published = true;
        return bundle.metadata;
      } catch (error) {
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          `No fue posible publicar el snapshot ${id}: ${describeError(error)}`,
        );
      } finally {
        if (!published && stageDirectory) {
          await rm(stageDirectory, { recursive: true, force: true }).catch(
            () => undefined,
          );
        }
      }
    });
  }
}
