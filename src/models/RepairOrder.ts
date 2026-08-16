export type RepairOrder = {
  shop: string;
  roNumber: string;
  customer: string;
  vehicle: string;
  stage: string;
  laborHours: number;
  preTaxTotal: number;
  estimator: string;
  technician: string;
  insurance: string;
  createdDate: string;
  arrivalDate: string;
  completedDate: string;
  vehicleStatus: string;
};

export type ImportedWipRecord = {
  source: string;
  fileName: string;
  importedAt: string;
  rowCount: number;
  selectedShop?: string;
  rows: Record<string, string>[];
};
