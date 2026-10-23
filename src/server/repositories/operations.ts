import { CsvOperationsRepository } from "./csv-operations";
import type { OperationsRepository } from "./types";

let defaultRepository: OperationsRepository | undefined;

export function getOperationsRepository(): OperationsRepository {
  defaultRepository ??= new CsvOperationsRepository();
  return defaultRepository;
}

export { CsvOperationsRepository } from "./csv-operations";
export type {
  DashboardSource,
  OperationsRepository,
  SnapshotBundle,
} from "./types";
