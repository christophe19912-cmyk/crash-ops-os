export type ScheduleDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export type RepairSeverity = "Light" | "Medium" | "Heavy";

export type ScheduledDrop = {
  id: string;
  shop: string;
  day: ScheduleDay;
  customer: string;
  vehicle: string;
  roNumber: string;
  estimatedLaborHours: number;
  severity: RepairSeverity;
  notes: string;
  createdAt: string;

  // CCC estimate intake fields. Optional so existing locally-stored schedules remain valid.
  vin?: string;
  cccJobNumber?: string;
  claimNumber?: string;
  workfileId?: string;
  insuranceCompany?: string;
  estimator?: string;
  bodyLaborHours?: number;
  paintLaborHours?: number;
  frameLaborHours?: number;
  mechanicalLaborHours?: number;
  partsTotal?: number;
  bodyLaborTotal?: number;
  paintLaborTotal?: number;
  paintMaterialsTotal?: number;
  salesTax?: number;
  totalCostOfRepairs?: number;
  deductible?: number;
  adjustments?: number;
  netCostOfRepairs?: number;
  estimateImageName?: string;
  vehiclePhotoDataUrl?: string;
};
