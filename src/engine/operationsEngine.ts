import type { RepairOrder } from "../models/RepairOrder";
import { daysSince } from "../services/importedData";
import {
  getStageDefinition,
  isBackOrderedParts,
  isCompletedHold,
  isPartsOrdered,
  isProductionHold,
} from "../services/stageDictionary";

export type RiskLevel =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type ScoreReason = {
  label: string;
  points: number;
  explanation: string;
};

export type RepairHealth = {
  repairOrder: RepairOrder;
  healthScore: number;
  priorityScore: number;
  riskLevel: RiskLevel;
  daysOnSite: number | null;
  stageName: string;
  blocker: string;
  healthReasons: ScoreReason[];
  priorityReasons: ScoreReason[];
  nextAction: string;
  suggestedOwner: string;
};

export type ShopHealth = {
  shop: string;
  healthScore: number;
  riskLevel: RiskLevel;
  repairCount: number;
  activeRepairCount: number;
  completedHoldCount: number;
  productionHoldCount: number;
  backOrderedPartsCount: number;
  partsOrderedCount: number;
  agingRepairCount: number;
  missingTechnicianCount: number;
  laborHours: number;
  preTaxTotal: number;
  averageRepairHealth: number;
  criticalRepairCount: number;
  highRiskRepairCount: number;
  topPriorities: RepairHealth[];
  scoreReasons: ScoreReason[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRiskLevel(score: number): RiskLevel {
  if (score <= 39) return "Critical";
  if (score <= 59) return "High";
  if (score <= 79) return "Medium";
  return "Low";
}

function calculateHealthReasons(
  repairOrder: RepairOrder,
  daysOnSite: number | null,
): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const stage = getStageDefinition(repairOrder.stage);

  if (isProductionHold(repairOrder.stage)) {
    reasons.push({
      label: "Production hold",
      points: -22,
      explanation:
        "The repair is stopped in a production-hold stage.",
    });
  }

  if (isBackOrderedParts(repairOrder.stage)) {
    reasons.push({
      label: "Back-ordered parts",
      points: -20,
      explanation:
        "The repair is blocked by unavailable parts.",
    });
  }

  if (isPartsOrdered(repairOrder.stage)) {
    reasons.push({
      label: "Parts ordered",
      points: -8,
      explanation:
        "The repair is waiting for ordered parts or parts verification.",
    });
  }

  if (isCompletedHold(repairOrder.stage)) {
    reasons.push({
      label: "Delivery closeout",
      points: -6,
      explanation:
        "Repairs are complete, but the vehicle remains onsite awaiting release.",
    });
  }

  if (
    repairOrder.technician === "Unassigned" &&
    stage.countsAsActiveProduction
  ) {
    reasons.push({
      label: "Missing technician",
      points: -10,
      explanation:
        "No service resource is assigned to this active repair.",
    });
  }

  if (
    repairOrder.estimator === "Unassigned" &&
    stage.countsAsActiveProduction
  ) {
    reasons.push({
      label: "Missing estimator",
      points: -7,
      explanation:
        "No sales or estimating resource is assigned.",
    });
  }

  if (daysOnSite !== null) {
    if (daysOnSite >= 30) {
      reasons.push({
        label: "Severe aging",
        points: -25,
        explanation: `The repair has been onsite for ${daysOnSite} days.`,
      });
    } else if (daysOnSite >= 20) {
      reasons.push({
        label: "High aging",
        points: -18,
        explanation: `The repair has been onsite for ${daysOnSite} days.`,
      });
    } else if (daysOnSite >= 14) {
      reasons.push({
        label: "Moderate aging",
        points: -10,
        explanation: `The repair has been onsite for ${daysOnSite} days.`,
      });
    } else if (daysOnSite >= 10) {
      reasons.push({
        label: "Aging review",
        points: -5,
        explanation: `The repair has been onsite for ${daysOnSite} days.`,
      });
    }
  }

  if (
    repairOrder.stage.trim().toUpperCase() === "BP" &&
    repairOrder.laborHours >= 35
  ) {
    reasons.push({
      label: "Large blueprint",
      points: -12,
      explanation:
        "A large-hour repair remains in Blueprint and may delay downstream production.",
    });
  }

  if (
    stage.category === "Unknown" ||
    stage.blocker === "Unknown"
  ) {
    reasons.push({
      label: "Unknown stage",
      points: -8,
      explanation:
        "The imported stage is not yet defined in the operations dictionary.",
    });
  }

  return reasons;
}

function calculatePriorityReasons(
  repairOrder: RepairOrder,
  daysOnSite: number | null,
): ScoreReason[] {
  const reasons: ScoreReason[] = [];

  if (isProductionHold(repairOrder.stage)) {
    reasons.push({
      label: "Production blocker",
      points: 28,
      explanation:
        "Production holds require immediate ownership and resolution.",
    });
  }

  if (isBackOrderedParts(repairOrder.stage)) {
    reasons.push({
      label: "Parts blocker",
      points: 25,
      explanation:
        "Back-ordered parts can threaten delivery and technician flow.",
    });
  }

  if (isCompletedHold(repairOrder.stage)) {
    reasons.push({
      label: "Completed onsite",
      points: 12,
      explanation:
        "A completed vehicle remains onsite and should be closed out.",
    });
  }

  if (daysOnSite !== null) {
    reasons.push({
      label: "Days onsite",
      points: Math.min(25, Math.floor(daysOnSite / 2)),
      explanation: `The repair has been onsite for ${daysOnSite} days.`,
    });
  }

  if (repairOrder.laborHours >= 60) {
    reasons.push({
      label: "Very large repair",
      points: 20,
      explanation:
        "This repair represents a significant amount of labor capacity.",
    });
  } else if (repairOrder.laborHours >= 35) {
    reasons.push({
      label: "Large repair",
      points: 14,
      explanation:
        "This repair represents a meaningful amount of labor capacity.",
    });
  } else if (repairOrder.laborHours >= 20) {
    reasons.push({
      label: "Medium repair",
      points: 7,
      explanation:
        "The repair carries a moderate labor workload.",
    });
  }

  if (repairOrder.preTaxTotal >= 20000) {
    reasons.push({
      label: "High repair value",
      points: 15,
      explanation:
        "The repair represents significant open sales value.",
    });
  } else if (repairOrder.preTaxTotal >= 10000) {
    reasons.push({
      label: "Material repair value",
      points: 8,
      explanation:
        "The repair represents material open sales value.",
    });
  }

  if (repairOrder.technician === "Unassigned") {
    reasons.push({
      label: "No technician assigned",
      points: 10,
      explanation:
        "Missing ownership increases the chance of production delay.",
    });
  }

  return reasons;
}

export function evaluateRepair(
  repairOrder: RepairOrder,
): RepairHealth {
  const daysOnSite = daysSince(repairOrder.arrivalDate);
  const stage = getStageDefinition(repairOrder.stage);

  const healthReasons = calculateHealthReasons(
    repairOrder,
    daysOnSite,
  );

  const priorityReasons = calculatePriorityReasons(
    repairOrder,
    daysOnSite,
  );

  const healthScore = clampScore(
    100 +
      healthReasons.reduce(
        (total, reason) => total + reason.points,
        0,
      ),
  );

  const priorityScore = clampScore(
    priorityReasons.reduce(
      (total, reason) => total + reason.points,
      0,
    ),
  );

  return {
    repairOrder,
    healthScore,
    priorityScore,
    riskLevel: getRiskLevel(healthScore),
    daysOnSite,
    stageName: stage.name,
    blocker: stage.blocker,
    healthReasons,
    priorityReasons,
    nextAction: stage.defaultAction,
    suggestedOwner: stage.defaultOwner,
  };
}

function shopRiskLevel(score: number): RiskLevel {
  return getRiskLevel(score);
}

export function evaluateShop(
  shop: string,
  repairOrders: RepairOrder[],
): ShopHealth {
  const shopOrders = repairOrders.filter(
    (repairOrder) => repairOrder.shop === shop,
  );

  const evaluatedRepairs = shopOrders.map(evaluateRepair);

  const averageRepairHealth =
    evaluatedRepairs.length > 0
      ? evaluatedRepairs.reduce(
          (total, repair) => total + repair.healthScore,
          0,
        ) / evaluatedRepairs.length
      : 100;

  const productionHoldCount = shopOrders.filter((order) =>
    isProductionHold(order.stage),
  ).length;

  const backOrderedPartsCount = shopOrders.filter((order) =>
    isBackOrderedParts(order.stage),
  ).length;

  const completedHoldCount = shopOrders.filter((order) =>
    isCompletedHold(order.stage),
  ).length;

  const partsOrderedCount = shopOrders.filter((order) =>
    isPartsOrdered(order.stage),
  ).length;

  const agingRepairCount = evaluatedRepairs.filter(
    (repair) =>
      repair.daysOnSite !== null &&
      repair.daysOnSite >= 20 &&
      !isCompletedHold(repair.repairOrder.stage),
  ).length;

  const missingTechnicianCount = shopOrders.filter(
    (order) =>
      order.technician === "Unassigned" &&
      !isCompletedHold(order.stage),
  ).length;

  const scoreReasons: ScoreReason[] = [];

  if (productionHoldCount >= 3) {
    scoreReasons.push({
      label: "Multiple production holds",
      points: -10,
      explanation: `${productionHoldCount} active repairs are in production-hold stages.`,
    });
  }

  if (backOrderedPartsCount >= 3) {
    scoreReasons.push({
      label: "Back-order concentration",
      points: -8,
      explanation: `${backOrderedPartsCount} active repairs are blocked by back-ordered parts.`,
    });
  }

  if (agingRepairCount >= 3) {
    scoreReasons.push({
      label: "Aging concentration",
      points: -10,
      explanation: `${agingRepairCount} active repairs have been onsite for at least 20 days.`,
    });
  }

  if (completedHoldCount >= 4) {
    scoreReasons.push({
      label: "Delivery closeout backlog",
      points: -5,
      explanation: `${completedHoldCount} completed vehicles remain onsite.`,
    });
  }

  if (missingTechnicianCount >= 3) {
    scoreReasons.push({
      label: "Missing ownership",
      points: -7,
      explanation: `${missingTechnicianCount} active repairs have no assigned technician.`,
    });
  }

  const healthScore = clampScore(
    averageRepairHealth +
      scoreReasons.reduce(
        (total, reason) => total + reason.points,
        0,
      ),
  );

  const topPriorities = evaluatedRepairs
    .slice()
    .sort((a, b) => {
      const priorityDifference =
        b.priorityScore - a.priorityScore;

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return a.healthScore - b.healthScore;
    })
    .slice(0, 10);

  return {
    shop,
    healthScore,
    riskLevel: shopRiskLevel(healthScore),
    repairCount: shopOrders.length,
    activeRepairCount: shopOrders.filter(
      (order) =>
        getStageDefinition(order.stage)
          .countsAsActiveProduction,
    ).length,
    completedHoldCount,
    productionHoldCount,
    backOrderedPartsCount,
    partsOrderedCount,
    agingRepairCount,
    missingTechnicianCount,
    laborHours: shopOrders.reduce(
      (total, order) => total + order.laborHours,
      0,
    ),
    preTaxTotal: shopOrders.reduce(
      (total, order) => total + order.preTaxTotal,
      0,
    ),
    averageRepairHealth: clampScore(averageRepairHealth),
    criticalRepairCount: evaluatedRepairs.filter(
      (repair) => repair.riskLevel === "Critical",
    ).length,
    highRiskRepairCount: evaluatedRepairs.filter(
      (repair) => repair.riskLevel === "High",
    ).length,
    topPriorities,
    scoreReasons,
  };
}

export function evaluateAllShops(
  repairOrders: RepairOrder[],
): ShopHealth[] {
  const shops = Array.from(
    new Set(repairOrders.map((order) => order.shop)),
  );

  return shops
    .map((shop) => evaluateShop(shop, repairOrders))
    .sort((a, b) => a.healthScore - b.healthScore);
}
