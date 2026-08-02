export type EstimatorLoadStatus =
  | "Light"
  | "Balanced"
  | "Heavy"
  | "Overloaded"
  | "Unassigned";

export type EstimatorRepairSummary = {
  shop: string;
  estimator: string;
  roNumber: string;
  vehicle: string;
  stage: string;
  laborHours: number;
  preTaxTotal: number;
  daysOnSite: number | null;
  healthScore: number;
  priorityScore: number;
  riskLevel: string;
  nextAction: string;
};

export type EstimatorLoad = {
  id: string;
  shop: string;
  estimator: string;
  openRepairCount: number;
  activeRepairCount: number;
  totalLaborHours: number;
  openRepairValue: number;
  highRiskRepairCount: number;
  criticalRepairCount: number;
  productionHoldCount: number;
  backOrderedPartsCount: number;
  agingRepairCount: number;
  workloadScore: number;
  teamAverageScore: number;
  workloadIndexPercent: number;
  status: EstimatorLoadStatus;
  recommendation: string;
  repairs: EstimatorRepairSummary[];
};

export type EstimatorLoadSnapshot = {
  generatedAt: string;
  estimators: EstimatorLoad[];
  summary: {
    estimatorCount: number;
    openRepairCount: number;
    activeRepairCount: number;
    totalLaborHours: number;
    openRepairValue: number;
    overloadedEstimatorCount: number;
    heavyEstimatorCount: number;
    unassignedRepairCount: number;
  };
};
