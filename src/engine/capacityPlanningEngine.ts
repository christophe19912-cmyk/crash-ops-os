import type { RepairOrder } from "../models/RepairOrder";
import type { ShopCapacitySettings } from "../models/CapacitySettings";
import { evaluateCapacity } from "./capacityEngine";
import { isCompletedHold } from "../services/stageDictionary";

export type RepairSeverity =
  | "Light"
  | "Medium"
  | "Heavy";

export type SeverityMix = {
  light: number;
  medium: number;
  heavy: number;
};

export type DailyDropPlan = {
  day: string;
  totalDrops: number;
  lightDrops: number;
  mediumDrops: number;
  heavyDrops: number;
  plannedLaborHours: number;
  projectedWipHours: number;
  projectedStatus:
    | "Capture Keys"
    | "Healthy"
    | "Flow Delay"
    | "True Overload";
  note: string;
};

export type CapacityPlan = {
  shop: string;
  currentWipHours: number;
  activeRepairCount: number;
  averageLaborHoursPerRepair: number;
  currentSeverityMix: SeverityMix;
  availableHealthyCapacityHours: number;
  weeklyDropCapacity: number;
  recommendedWeeklyDrops: number;
  recommendedMix: SeverityMix;
  fiveDayPlan: DailyDropPlan[];
  summary: string;
};

function classifySeverity(
  laborHours: number,
): RepairSeverity {
  if (laborHours < 20) return "Light";
  if (laborHours < 40) return "Medium";
  return "Heavy";
}

function countSeverity(
  orders: RepairOrder[],
): SeverityMix {
  return orders.reduce<SeverityMix>(
    (mix, order) => {
      const severity = classifySeverity(order.laborHours);

      if (severity === "Light") mix.light += 1;
      if (severity === "Medium") mix.medium += 1;
      if (severity === "Heavy") mix.heavy += 1;

      return mix;
    },
    {
      light: 0,
      medium: 0,
      heavy: 0,
    },
  );
}

function getRecommendedMix(
  totalDrops: number,
): SeverityMix {
  if (totalDrops <= 0) {
    return {
      light: 0,
      medium: 0,
      heavy: 0,
    };
  }

  const heavy = Math.floor(totalDrops * 0.2);
  const medium = Math.floor(totalDrops * 0.45);
  const light = totalDrops - heavy - medium;

  return {
    light,
    medium,
    heavy,
  };
}

function averageHoursForMix(
  mix: SeverityMix,
) {
  return (
    mix.light * 12 +
    mix.medium * 30 +
    mix.heavy * 55
  );
}

function distributeDrops(
  totalDrops: number,
  maxDailyDrops: number,
) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const result = Array(5).fill(0) as number[];
  let remaining = totalDrops;

  // Heavier early-week loading, then taper.
  const weights = [0.28, 0.26, 0.2, 0.14, 0.12];

  days.forEach((_, index) => {
    if (remaining <= 0) return;

    const target =
      index === days.length - 1
        ? remaining
        : Math.round(totalDrops * weights[index]);

    const drops = Math.max(
      0,
      Math.min(maxDailyDrops, target, remaining),
    );

    result[index] = drops;
    remaining -= drops;
  });

  let index = 0;

  while (remaining > 0) {
    if (result[index] < maxDailyDrops) {
      result[index] += 1;
      remaining -= 1;
    }

    index = (index + 1) % result.length;
  }

  return result;
}

function dayMix(totalDrops: number): SeverityMix {
  if (totalDrops <= 0) {
    return {
      light: 0,
      medium: 0,
      heavy: 0,
    };
  }

  if (totalDrops === 1) {
    return {
      light: 1,
      medium: 0,
      heavy: 0,
    };
  }

  if (totalDrops === 2) {
    return {
      light: 1,
      medium: 1,
      heavy: 0,
    };
  }

  if (totalDrops === 3) {
    return {
      light: 1,
      medium: 1,
      heavy: 1,
    };
  }

  return getRecommendedMix(totalDrops);
}

export function buildCapacityPlan(
  shop: string,
  repairOrders: RepairOrder[],
  settings: ShopCapacitySettings,
): CapacityPlan {
  const activeOrders = repairOrders.filter(
    (order) =>
      order.shop === shop &&
      !isCompletedHold(order.stage),
  );

  const currentWipHours = activeOrders.reduce(
    (total, order) => total + order.laborHours,
    0,
  );

  const currentSeverityMix =
    countSeverity(activeOrders);

  const currentCapacity = evaluateCapacity(
    {
      hoursInProcess: currentWipHours,
      vehiclesOnsite: activeOrders.length,
    },
    settings,
  );

  const averageLaborHoursPerRepair =
    activeOrders.length > 0
      ? currentWipHours / activeOrders.length
      : settings.averageLaborHoursPerDrop;

  const weeklyDropCapacity =
    settings.averageLaborHoursPerDrop > 0
      ? Math.max(
          0,
          Math.floor(
            currentCapacity.availableCapacityHours /
              settings.averageLaborHoursPerDrop,
          ),
        )
      : 0;

  const maximumWeeklyDrops =
    settings.maximumDailyDrops * 5;

  const recommendedWeeklyDrops = Math.min(
    weeklyDropCapacity,
    maximumWeeklyDrops,
  );

  const recommendedMix = getRecommendedMix(
    recommendedWeeklyDrops,
  );

  const dailyDropCounts = distributeDrops(
    recommendedWeeklyDrops,
    settings.maximumDailyDrops,
  );

  let projectedWipHours = currentWipHours;

  const estimatedDailyOutput =
    currentCapacity.estimatedDailyLaborOutput;

  const fiveDayPlan = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ].map((day, index) => {
    const totalDrops = dailyDropCounts[index];
    const mix = dayMix(totalDrops);
    const plannedLaborHours =
      averageHoursForMix(mix);

    projectedWipHours = Math.max(
      0,
      projectedWipHours -
        estimatedDailyOutput +
        plannedLaborHours,
    );

    const projection = evaluateCapacity(
      {
        hoursInProcess: projectedWipHours,
        vehiclesOnsite:
          activeOrders.length +
          dailyDropCounts
            .slice(0, index + 1)
            .reduce(
              (total, drops) => total + drops,
              0,
            ),
      },
      settings,
    );

    let note = "Maintain planned mix.";

    if (projection.status === "True Overload") {
      note =
        "Move heavy drops later or reduce total drops.";
    } else if (projection.status === "Capture Keys") {
      note =
        "Capacity remains available for additional light work.";
    } else if (mix.heavy > 0) {
      note =
        "Protect blueprint and parts readiness for heavy work.";
    }

    return {
      day,
      totalDrops,
      lightDrops: mix.light,
      mediumDrops: mix.medium,
      heavyDrops: mix.heavy,
      plannedLaborHours,
      projectedWipHours:
        Math.round(projectedWipHours),
      projectedStatus: projection.status,
      note,
    };
  });

  let summary: string;

  if (currentCapacity.status === "True Overload") {
    summary =
      "Current WIP is above the maximum threshold. Do not add heavy work until active hours fall below the overload limit.";
  } else if (recommendedWeeklyDrops === 0) {
    summary =
      "Current WIP is near the healthy limit. Protect completions before adding additional work.";
  } else {
    summary =
      `The shop can accept approximately ${recommendedWeeklyDrops} additional drop${recommendedWeeklyDrops === 1 ? "" : "s"} this week while staying within the configured healthy WIP range.`;
  }

  return {
    shop,
    currentWipHours,
    activeRepairCount: activeOrders.length,
    averageLaborHoursPerRepair,
    currentSeverityMix,
    availableHealthyCapacityHours:
      currentCapacity.availableCapacityHours,
    weeklyDropCapacity,
    recommendedWeeklyDrops,
    recommendedMix,
    fiveDayPlan,
    summary,
  };
}
