export type TechnicianLoadStatus =
  | "Available"
  | "Balanced"
  | "Near Capacity"
  | "Overloaded"
  | "Unassigned";

export type TechnicianRepairSummary = {
  shop: string;
  technician: string;
  roNumber: string;
  vehicle: string;
  stage: string;
  laborHours: number;
  healthScore: number;
  priorityScore: number;
  riskLevel: string;
  nextAction: string;
};

export type TechnicianLoad = {
  id: string;
  shop: string;
  technician: string;
  assignedRepairCount: number;
  assignedLaborHours: number;
  weeklyCapacityHours: number;
  remainingCapacityHours: number;
  utilizationPercent: number;
  highRiskRepairCount: number;
  productionHoldCount: number;
  backOrderedPartsCount: number;
  status: TechnicianLoadStatus;
  recommendation: string;
  repairs: TechnicianRepairSummary[];
};

export type TechnicianLoadSnapshot = {
  generatedAt: string;
  technicians: TechnicianLoad[];
  summary: {
    technicianCount: number;
    assignedRepairCount: number;
    assignedLaborHours: number;
    availableTechnicianCount: number;
    overloadedTechnicianCount: number;
    unassignedRepairCount: number;
    unassignedLaborHours: number;
  };
};
