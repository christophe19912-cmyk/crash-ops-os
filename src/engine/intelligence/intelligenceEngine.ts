import type { RepairOrder } from "../../models/RepairOrder";
import {
  evaluateRepair,
  evaluateShop,
  type RepairHealth,
  type RiskLevel,
  type ShopHealth,
} from "../operationsEngine";
import {
  evaluateCapacity,
  type CapacityEvaluation,
} from "../capacityEngine";
import {
  buildCapacityPlan,
  type CapacityPlan,
} from "../capacityPlanningEngine";
import {
  buildOperationalRecommendations,
  type OperationalRecommendation,
} from "../../services/recommendationEngine";
import { getCapacitySettings } from "../../services/capacitySettings";
import {
  getStageDefinition,
  isBackOrderedParts,
  isCompletedHold,
  isProductionHold,
} from "../../services/stageDictionary";

export type IntelligenceAlert = {
  id: string;
  shop: string;
  severity: "Info" | "Warning" | "Critical";
  category:
    | "Capacity"
    | "Parts"
    | "Production"
    | "Aging"
    | "Delivery";
  title: string;
  explanation: string;
  recommendedAction: string;
};

export type RepairIntelligence = {
  repairOrder: RepairOrder;
  health: RepairHealth;
  isActiveProduction: boolean;
  isBackOrderedParts: boolean;
  isProductionHold: boolean;
  isCompletedHold: boolean;
  needsManagementAttention: boolean;
};

export type ShopIntelligence = {
  shop: string;
  health: ShopHealth;
  capacity: CapacityEvaluation;
  capacityPlan: CapacityPlan;
  repairs: RepairIntelligence[];
  recommendations: OperationalRecommendation[];
  alerts: IntelligenceAlert[];
  overallRisk: RiskLevel;
  activeRepairCount: number;
  activeLaborHours: number;
  openRepairValue: number;
};

export type IntelligenceSnapshot = {
  generatedAt: string;
  shops: ShopIntelligence[];
  repairs: RepairIntelligence[];
  recommendations: OperationalRecommendation[];
  alerts: IntelligenceAlert[];
  summary: {
    shopCount: number;
    repairCount: number;
    activeRepairCount: number;
    activeLaborHours: number;
    openRepairValue: number;
    criticalRepairCount: number;
    highRiskRepairCount: number;
    productionHoldCount: number;
    backOrderedPartsCount: number;
    completedHoldCount: number;
    recommendedWeeklyDrops: number;
    criticalAlertCount: number;
  };
};

function analyzeRepair(
  repairOrder: RepairOrder,
): RepairIntelligence {
  const health = evaluateRepair(repairOrder);
  const stage = getStageDefinition(repairOrder.stage);
  const completedHold = isCompletedHold(repairOrder.stage);

  return {
    repairOrder,
    health,
    isActiveProduction:
      stage.countsAsActiveProduction && !completedHold,
    isBackOrderedParts: isBackOrderedParts(repairOrder.stage),
    isProductionHold: isProductionHold(repairOrder.stage),
    isCompletedHold: completedHold,
    needsManagementAttention:
      health.riskLevel === "Critical" ||
      health.riskLevel === "High" ||
      isBackOrderedParts(repairOrder.stage) ||
      isProductionHold(repairOrder.stage),
  };
}

function buildAlerts(
  shop: string,
  repairs: RepairIntelligence[],
  capacity: CapacityEvaluation,
): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];

  if (capacity.status === "True Overload") {
    alerts.push({
      id: `${shop}-capacity`,
      shop,
      severity: "Critical",
      category: "Capacity",
      title: "Shop is above maximum WIP",
      explanation:
        `${capacity.loadPercent}% of healthy WIP is loaded with ${capacity.weeksToClear} weeks to clear.`,
      recommendedAction:
        "Reduce incoming drops and protect current completions before accepting additional heavy work.",
    });
  } else if (capacity.status === "Flow Delay") {
    alerts.push({
      id: `${shop}-flow`,
      shop,
      severity: "Warning",
      category: "Capacity",
      title: "Flow is below target",
      explanation:
        "Current workload is manageable, but movement is below the configured target.",
      recommendedAction:
        "Perform a production WIP walk and remove stage, parts, assignment, and approval blockers.",
    });
  } else if (capacity.status === "Capture Keys") {
    alerts.push({
      id: `${shop}-capture`,
      shop,
      severity: "Info",
      category: "Capacity",
      title: "Capacity is available",
      explanation:
        `${capacity.availableCapacityHours} healthy capacity hours remain available.`,
      recommendedAction:
        `Consider adding up to ${capacity.recommendedDailyDrops} appropriately sized drops per day.`,
    });
  }

  const backOrders = repairs.filter(
    (repair) => repair.isBackOrderedParts,
  );

  if (backOrders.length > 0) {
    alerts.push({
      id: `${shop}-bop`,
      shop,
      severity: backOrders.length >= 3 ? "Critical" : "Warning",
      category: "Parts",
      title: `${backOrders.length} back-ordered parts repair${
        backOrders.length === 1 ? "" : "s"
      }`,
      explanation:
        "Back-ordered parts reduce scheduling flexibility and threaten delivery commitments.",
      recommendedAction:
        "Verify ETAs, investigate alternate sourcing, update customers, and revise delivery dates.",
    });
  }

  const holds = repairs.filter(
    (repair) => repair.isProductionHold,
  );

  if (holds.length > 0) {
    alerts.push({
      id: `${shop}-holds`,
      shop,
      severity: holds.length >= 3 ? "Critical" : "Warning",
      category: "Production",
      title: `${holds.length} active production hold${
        holds.length === 1 ? "" : "s"
      }`,
      explanation:
        "Held repairs require a documented blocker, owner, and next action.",
      recommendedAction:
        "Assign ownership and a same-day recovery action to every held repair.",
    });
  }

  const completed = repairs.filter(
    (repair) => repair.isCompletedHold,
  );

  if (completed.length > 0) {
    alerts.push({
      id: `${shop}-completed`,
      shop,
      severity: completed.length >= 4 ? "Warning" : "Info",
      category: "Delivery",
      title: `${completed.length} completed vehicle${
        completed.length === 1 ? "" : "s"
      } awaiting release`,
      explanation:
        "Completed vehicles remain onsite awaiting pickup or final authorization.",
      recommendedAction:
        "Resolve final authorization, contact customers, and complete delivery closeout.",
    });
  }

  const aged = repairs.filter(
    (repair) =>
      repair.isActiveProduction &&
      repair.health.daysOnSite !== null &&
      repair.health.daysOnSite >= 20,
  );

  if (aged.length > 0) {
    alerts.push({
      id: `${shop}-aging`,
      shop,
      severity: aged.length >= 3 ? "Critical" : "Warning",
      category: "Aging",
      title: `${aged.length} active aging repair${
        aged.length === 1 ? "" : "s"
      }`,
      explanation:
        "These repairs have been onsite at least 20 days.",
      recommendedAction:
        "Confirm the next measurable production event for each aged repair.",
    });
  }

  return alerts;
}

function getOverallRisk(
  healthScore: number,
  capacityStatus: string,
): RiskLevel {
  if (capacityStatus === "True Overload") return "Critical";
  if (healthScore <= 39) return "Critical";
  if (healthScore <= 59) return "High";
  if (healthScore <= 79 || capacityStatus === "Flow Delay") {
    return "Medium";
  }
  return "Low";
}

export function buildIntelligenceSnapshot(
  repairOrders: RepairOrder[],
): IntelligenceSnapshot {
  const repairs = repairOrders.map(analyzeRepair);

  const shopNames = Array.from(
    new Set(
      repairOrders
        .map((order) => order.shop)
        .filter(Boolean),
    ),
  );

  const shops: ShopIntelligence[] = shopNames.map((shop) => {
    const shopOrders = repairOrders.filter(
      (order) => order.shop === shop,
    );

    const shopRepairs = repairs.filter(
      (repair) => repair.repairOrder.shop === shop,
    );

    const activeRepairs = shopRepairs.filter(
      (repair) => repair.isActiveProduction,
    );

    const activeLaborHours = activeRepairs.reduce(
      (total, repair) =>
        total + repair.repairOrder.laborHours,
      0,
    );

    const settings = getCapacitySettings(shop);

    const capacity = evaluateCapacity(
      {
        hoursInProcess: activeLaborHours,
        vehiclesOnsite: activeRepairs.length,
      },
      settings,
    );

    const health = evaluateShop(shop, repairOrders);
    const capacityPlan = buildCapacityPlan(
      shop,
      repairOrders,
      settings,
    );

    const recommendations =
      buildOperationalRecommendations(shopOrders);

    const alerts = buildAlerts(
      shop,
      shopRepairs,
      capacity,
    );

    return {
      shop,
      health,
      capacity,
      capacityPlan,
      repairs: shopRepairs,
      recommendations,
      alerts,
      overallRisk: getOverallRisk(
        health.healthScore,
        capacity.status,
      ),
      activeRepairCount: activeRepairs.length,
      activeLaborHours,
      openRepairValue: shopOrders.reduce(
        (total, order) => total + order.preTaxTotal,
        0,
      ),
    };
  });

  const recommendations = shops
    .flatMap((shop) => shop.recommendations)
    .sort((a, b) => {
      const rank = {
        Critical: 4,
        High: 3,
        Medium: 2,
        Low: 1,
      };
      return rank[b.priority] - rank[a.priority];
    });

  const alerts = shops
    .flatMap((shop) => shop.alerts)
    .sort((a, b) => {
      const rank = {
        Critical: 3,
        Warning: 2,
        Info: 1,
      };
      return rank[b.severity] - rank[a.severity];
    });

  const activeRepairs = repairs.filter(
    (repair) => repair.isActiveProduction,
  );

  return {
    generatedAt: new Date().toISOString(),
    shops,
    repairs,
    recommendations,
    alerts,
    summary: {
      shopCount: shops.length,
      repairCount: repairs.length,
      activeRepairCount: activeRepairs.length,
      activeLaborHours: activeRepairs.reduce(
        (total, repair) =>
          total + repair.repairOrder.laborHours,
        0,
      ),
      openRepairValue: repairOrders.reduce(
        (total, order) => total + order.preTaxTotal,
        0,
      ),
      criticalRepairCount: repairs.filter(
        (repair) =>
          repair.health.riskLevel === "Critical",
      ).length,
      highRiskRepairCount: repairs.filter(
        (repair) =>
          repair.health.riskLevel === "High",
      ).length,
      productionHoldCount: repairs.filter(
        (repair) => repair.isProductionHold,
      ).length,
      backOrderedPartsCount: repairs.filter(
        (repair) => repair.isBackOrderedParts,
      ).length,
      completedHoldCount: repairs.filter(
        (repair) => repair.isCompletedHold,
      ).length,
      recommendedWeeklyDrops: shops.reduce(
        (total, shop) =>
          total + shop.capacityPlan.recommendedWeeklyDrops,
        0,
      ),
      criticalAlertCount: alerts.filter(
        (alert) => alert.severity === "Critical",
      ).length,
    },
  };
}
