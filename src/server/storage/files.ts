import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  centerCsvRowSchema,
  expectedDonationCsvRowSchema,
  inventoryCsvRowSchema,
  needCsvRowSchema,
  presentationCsvRowSchema,
  productCsvRowSchema,
  snapshotMetadataSchema,
  travelTimeCsvRowSchema,
  validateSnapshotBundle,
  volunteerCsvRowSchema,
  type SnapshotBundle,
} from "@/contracts/schemas/data";
import {
  CSV_COLUMNS,
  CSV_FILE_NAMES,
  parseCsvRows,
  stringifyCsvRows,
} from "./csv";

export async function requireNoSymlinkComponents(targetPath: string) {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const segments = resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;

  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`No se permiten enlaces simbólicos: ${current}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}

async function requireRegularFile(filePath: string) {
  await requireNoSymlinkComponents(filePath);
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`Se esperaba un archivo regular: ${filePath}.`);
  }
}

export async function requireDirectory(directoryPath: string) {
  await requireNoSymlinkComponents(directoryPath);
  const stats = await lstat(directoryPath);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Se esperaba un directorio real: ${directoryPath}.`);
  }
}

export function resolveWithin(root: string, ...segments: string[]) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, target);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("La ruta solicitada está fuera del almacenamiento permitido.");
  }

  return target;
}

export function rejectPublicStorage(root: string) {
  const publicRoot = path.resolve(process.cwd(), "public");
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(publicRoot, resolvedRoot);
  const isInsidePublic =
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));

  if (isInsidePublic) {
    throw new Error("El almacenamiento interno no puede ubicarse dentro de public/.");
  }
}

async function readTextFile(snapshotDirectory: string, fileName: string) {
  const filePath = resolveWithin(snapshotDirectory, fileName);
  await requireRegularFile(filePath);
  return readFile(filePath, "utf8");
}

export async function readSnapshotBundle(
  snapshotDirectory: string,
  expectedSnapshotId: string,
): Promise<SnapshotBundle> {
  await requireDirectory(snapshotDirectory);

  const metadataText = await readTextFile(snapshotDirectory, "metadata.json");
  const metadata = snapshotMetadataSchema.parse(JSON.parse(metadataText));
  if (metadata.id !== expectedSnapshotId) {
    throw new Error(
      `El metadata del snapshot ${metadata.id} no coincide con el directorio ${expectedSnapshotId}.`,
    );
  }

  const [
    centersText,
    productsText,
    presentationsText,
    inventoryText,
    needsText,
    volunteersText,
    travelTimesText,
    expectedDonationsText,
  ] = await Promise.all([
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.centers),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.products),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.presentations),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.inventory),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.needs),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.volunteers),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.travelTimes),
    readTextFile(snapshotDirectory, CSV_FILE_NAMES.expectedDonations),
  ]);

  return validateSnapshotBundle({
    metadata,
    centers: parseCsvRows(centersText, CSV_COLUMNS.centers, centerCsvRowSchema),
    products: parseCsvRows(productsText, CSV_COLUMNS.products, productCsvRowSchema),
    presentations: parseCsvRows(
      presentationsText,
      CSV_COLUMNS.presentations,
      presentationCsvRowSchema,
    ),
    inventory: parseCsvRows(
      inventoryText,
      CSV_COLUMNS.inventory,
      inventoryCsvRowSchema,
    ),
    needs: parseCsvRows(needsText, CSV_COLUMNS.needs, needCsvRowSchema),
    volunteers: parseCsvRows(
      volunteersText,
      CSV_COLUMNS.volunteers,
      volunteerCsvRowSchema,
    ),
    travelTimes: parseCsvRows(
      travelTimesText,
      CSV_COLUMNS.travelTimes,
      travelTimeCsvRowSchema,
    ),
    expectedDonations: parseCsvRows(
      expectedDonationsText,
      CSV_COLUMNS.expectedDonations,
      expectedDonationCsvRowSchema,
    ),
  });
}

async function writeExclusive(filePath: string, content: string) {
  await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
}

export async function writeSnapshotBundle(
  snapshotDirectory: string,
  bundle: SnapshotBundle,
) {
  await requireNoSymlinkComponents(snapshotDirectory);
  await mkdir(snapshotDirectory, { recursive: false });
  await requireDirectory(snapshotDirectory);

  await writeExclusive(
    resolveWithin(snapshotDirectory, "metadata.json"),
    `${JSON.stringify(bundle.metadata, null, 2)}\n`,
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.centers),
    stringifyCsvRows(bundle.centers, CSV_COLUMNS.centers),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.products),
    stringifyCsvRows(bundle.products, CSV_COLUMNS.products),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.presentations),
    stringifyCsvRows(bundle.presentations, CSV_COLUMNS.presentations),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.inventory),
    stringifyCsvRows(bundle.inventory, CSV_COLUMNS.inventory),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.needs),
    stringifyCsvRows(bundle.needs, CSV_COLUMNS.needs),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.volunteers),
    stringifyCsvRows(bundle.volunteers, CSV_COLUMNS.volunteers),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.travelTimes),
    stringifyCsvRows(bundle.travelTimes, CSV_COLUMNS.travelTimes),
  );
  await writeExclusive(
    resolveWithin(snapshotDirectory, CSV_FILE_NAMES.expectedDonations),
    stringifyCsvRows(bundle.expectedDonations, CSV_COLUMNS.expectedDonations),
  );
}
