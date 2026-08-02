export type EstimatorRole =
  | "Primary Estimator"
  | "Supplement Estimator"
  | "Manager"
  | "CSR";

export type EstimatorSettings = {
  id: string;
  shop: string;
  estimator: string;
  role: EstimatorRole;
  weeklyAvailabilityHours: number;
  expectedFileCapacity: number;
  supplementResponsibility: boolean;
  ptoDaysThisWeek: number;
  active: boolean;
  workloadAdjustment: number;
};
