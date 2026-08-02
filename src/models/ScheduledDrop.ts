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
};
