import type { SnapshotBundle } from "@/contracts/schemas/data";
import type {
  CenterRecord,
  ExpectedDonationRecord,
  InventoryRecord,
  NeedRecord,
  PresentationRecord,
  ProductRecord,
  SnapshotRecord,
  TravelTimeRecord,
  VolunteerRecord,
} from "@/contracts/types/database";

export interface DashboardSource {
  snapshot: SnapshotRecord | null;
  centers: CenterRecord[];
  products: ProductRecord[];
  presentations: PresentationRecord[];
  inventory: InventoryRecord[];
  needs: NeedRecord[];
  volunteers: VolunteerRecord[];
  travelTimes: TravelTimeRecord[];
  expectedDonations: ExpectedDonationRecord[];
}

export interface OperationsRepository {
  listSnapshots(): Promise<SnapshotRecord[]>;
  findSnapshot(snapshotId: string): Promise<SnapshotRecord | null>;
  listCenters(snapshotId: string): Promise<CenterRecord[]>;
  listProducts(snapshotId: string): Promise<ProductRecord[]>;
  listPresentations(snapshotId: string): Promise<PresentationRecord[]>;
  listInventory(snapshotId: string): Promise<InventoryRecord[]>;
  listNeeds(snapshotId: string): Promise<NeedRecord[]>;
  listVolunteers(snapshotId: string): Promise<VolunteerRecord[]>;
  listTravelTimes(snapshotId: string): Promise<TravelTimeRecord[]>;
  listExpectedDonations(snapshotId: string): Promise<ExpectedDonationRecord[]>;
  getDashboardSource(snapshotId: string): Promise<DashboardSource>;
  writeSnapshot(input: unknown): Promise<SnapshotRecord>;
}

export type { SnapshotBundle };
