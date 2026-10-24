import { CsvOperationsRepository } from "./csv-operations";
import type { OperationsRepository } from "./types";

let defaultRepository: OperationsRepository | undefined;

export function getOperationsRepository(): OperationsRepository {
  defaultRepository ??= new CsvOperationsRepository({
    demoRoot: process.env.OPERATIONS_DEMO_ROOT,
    runtimeRoot: process.env.OPERATIONS_RUNTIME_ROOT,
  });
  return defaultRepository;
}

export { CsvOperationsRepository } from "./csv-operations";
export type {
  DashboardSource,
  OperationsRepository,
  SnapshotBundle,
} from "./types";
