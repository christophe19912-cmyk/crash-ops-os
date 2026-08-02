export type CapacityStatus =
  | "Capture Keys"
  | "Healthy"
  | "Flow Delay"
  | "True Overload";

export type ShopCapacitySettings = {
  shop: string;
  weeklyLaborOutputTarget: number;
  monthlyLaborOutputTarget: number;
  productiveWorkdaysPerMonth: number;
  targetTouchTimeHours: number;
  targetCycleTimeDays: number;
  healthyWipWeeks: number;
  maximumWipWeeks: number;
  productiveTechnicians: number;
  productiveBays: number;
  averageLaborHoursPerDrop: number;
  maximumDailyDrops: number;
  schedulingBufferPercent: number;
  updatedAt: string;
};

export type CapacitySettingsStore = Record<
  string,
  ShopCapacitySettings
>;
