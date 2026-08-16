export type TechnicianRole =
  | "Body Technician"
  | "Structural Technician"
  | "Combination Technician"
  | "Apprentice"
  | "Paint Technician";

export type TechnicianSettings = {
  id: string;
  shop: string;
  technician: string;
  role: TechnicianRole;
  weeklyLaborTarget: number;
  weeklyAvailabilityHours: number;
  ptoDaysThisWeek: number;
  active: boolean;
  capacityAdjustment: number;
};
