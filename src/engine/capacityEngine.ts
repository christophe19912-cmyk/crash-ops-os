import type {
  CapacityStatus,
  ShopCapacitySettings,
} from "../models/CapacitySettings";

export type CapacityInputs = {
  hoursInProcess: number;
  vehiclesOnsite: number;
  cycleTimeDays?: number | null;
  touchTimeHours?: number | null;
};

export type CapacityEvaluation = {
  weeksToClear: number;
  workdaysToClear: number;
  targetWipHours: number;
  maximumWipHours: number;
  usableWeeklyOutput: number;
  loadPercent: number;
  bayPressure: number;
  estimatedDailyLaborOutput: number;
  recommendedDailyDrops: number;
  availableCapacityHours: number;
  status: CapacityStatus;
  recommendation: string;
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function evaluateCapacity(
  inputs: CapacityInputs,
  settings: ShopCapacitySettings,
): CapacityEvaluation {
  const schedulingFactor =
    Math.max(0, 100 - settings.schedulingBufferPercent) / 100;

  const usableWeeklyOutput =
    settings.weeklyLaborOutputTarget * schedulingFactor;

  const safeWeeklyOutput = Math.max(1, usableWeeklyOutput);
  const weeksToClear = inputs.hoursInProcess / safeWeeklyOutput;
  const workdaysToClear = weeksToClear * 5;

  const targetWipHours =
    safeWeeklyOutput * settings.healthyWipWeeks;

  const maximumWipHours =
    safeWeeklyOutput * settings.maximumWipWeeks;

  const loadPercent =
    targetWipHours > 0
      ? (inputs.hoursInProcess / targetWipHours) * 100
      : 0;

  const bayPressure =
    settings.productiveBays > 0
      ? inputs.vehiclesOnsite / settings.productiveBays
      : 0;

  const estimatedDailyLaborOutput =
    settings.productiveWorkdaysPerMonth > 0
      ? settings.monthlyLaborOutputTarget /
        settings.productiveWorkdaysPerMonth
      : settings.weeklyLaborOutputTarget / 5;

  const availableCapacityHours = Math.max(
    0,
    targetWipHours - inputs.hoursInProcess,
  );

  const capacityDropRecommendation =
    settings.averageLaborHoursPerDrop > 0
      ? Math.floor(
          availableCapacityHours /
            settings.averageLaborHoursPerDrop /
            Math.max(1, settings.healthyWipWeeks * 5),
        )
      : 0;

  const recommendedDailyDrops = Math.max(
    0,
    Math.min(
      settings.maximumDailyDrops,
      capacityDropRecommendation,
    ),
  );

  const hasFlowDelay =
    inputs.cycleTimeDays !== null &&
    inputs.cycleTimeDays !== undefined &&
    inputs.touchTimeHours !== null &&
    inputs.touchTimeHours !== undefined &&
    inputs.cycleTimeDays > settings.targetCycleTimeDays &&
    inputs.touchTimeHours < settings.targetTouchTimeHours;

  let status: CapacityStatus;
  let recommendation: string;

  if (inputs.hoursInProcess > maximumWipHours) {
    status = "True Overload";
    recommendation =
      "Reduce or reschedule incoming drops, protect current deliveries, and avoid adding heavy repairs until WIP falls below the maximum threshold.";
  } else if (hasFlowDelay) {
    status = "Flow Delay";
    recommendation =
      "Current workload is manageable, but movement is below target. Perform a production WIP walk and remove stage, parts, assignment, or approval blockers.";
  } else if (inputs.hoursInProcess < targetWipHours * 0.8) {
    status = "Capture Keys";
    recommendation =
      recommendedDailyDrops > 0
        ? `Capacity is available. Consider adding up to ${recommendedDailyDrops} appropriately sized drop${recommendedDailyDrops === 1 ? "" : "s"} per day.`
        : "Capacity is available. Review the severity mix and add light-to-medium work without exceeding the shop's daily drop limit.";
  } else {
    status = "Healthy";
    recommendation =
      "Maintain the current scheduling pace and monitor future drops against expected completions.";
  }

  return {
    weeksToClear: round(weeksToClear, 2),
    workdaysToClear: round(workdaysToClear, 1),
    targetWipHours: round(targetWipHours),
    maximumWipHours: round(maximumWipHours),
    usableWeeklyOutput: round(usableWeeklyOutput),
    loadPercent: round(loadPercent),
    bayPressure: round(bayPressure, 2),
    estimatedDailyLaborOutput: round(
      estimatedDailyLaborOutput,
    ),
    recommendedDailyDrops,
    availableCapacityHours: round(availableCapacityHours),
    status,
    recommendation,
  };
}
