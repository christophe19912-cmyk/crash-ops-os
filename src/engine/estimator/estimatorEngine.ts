import type {
  IntelligenceSnapshot,
  RepairIntelligence,
} from "../intelligence";
import { getEstimatorSettings } from "../../services/estimatorSettings";
import type {
  EstimatorLoad,
  EstimatorLoadSnapshot,
  EstimatorLoadStatus,
} from "./estimatorTypes";

function normalizeEstimator(name: string) {
  const trimmed = name.trim();

  if (
    !trimmed ||
    trimmed.toLowerCase() === "unassigned" ||
    trimmed.toLowerCase() === "none" ||
    trimmed.toLowerCase() === "n/a"
  ) {
    return "Unassigned";
  }

  return trimmed;
}

function calculateWorkloadScore(
  repairCount: number,
  laborHours: number,
  highRiskCount: number,
  holdCount: number,
  backOrderedCount: number,
  agingCount: number,
) {
  return (
    repairCount * 10 +
    laborHours * 0.5 +
    highRiskCount * 15 +
    holdCount * 10 +
    backOrderedCount * 8 +
    agingCount * 8
  );
}

function getStatus(
  estimator: string,
  workloadIndexPercent: number,
): EstimatorLoadStatus {
  if (estimator === "Unassigned") return "Unassigned";
  if (workloadIndexPercent < 80) return "Light";
  if (workloadIndexPercent <= 120) return "Balanced";
  if (workloadIndexPercent <= 150) return "Heavy";
  return "Overloaded";
}

function getRecommendation(
  estimator: string,
  status: EstimatorLoadStatus,
  openRepairCount: number,
  highRiskCount: number,
  holdCount: number,
  backOrderedCount: number,
  agingCount: number,
) {
  if (estimator === "Unassigned") {
    return "Assign estimator ownership to these repairs before additional administrative work is added.";
  }

  if (status === "Overloaded") {
    return "Rebalance new assignments and move selected follow-up work to a lighter estimator. Protect critical approvals, supplements, and customer communication first.";
  }

  if (status === "Heavy") {
    return "Limit new assignments until priority repairs, holds, and aging files have clear next actions.";
  }

  if (holdCount > 0 || backOrderedCount > 0) {
    return `Resolve ${holdCount} production hold${
      holdCount === 1 ? "" : "s"
    } and ${backOrderedCount} back-ordered parts file${
      backOrderedCount === 1 ? "" : "s"
    } before adding avoidable administrative load.`;
  }

  if (highRiskCount > 0 || agingCount > 0) {
    return `Prioritize ${highRiskCount} high-risk and ${agingCount} aging repair${
      agingCount === 1 ? "" : "s"
    } during today's file review.`;
  }

  if (status === "Light") {
    return `This estimator is carrying a lighter share of the current workload and may be able to absorb selected new assignments or follow-up tasks.`;
  }

  return `${openRepairCount} open repairs are currently balanced against the shop's estimator team average.`;
}

function toRepairSummary(repair: RepairIntelligence) {
  return {
    shop: repair.repairOrder.shop,
    estimator: normalizeEstimator(
      repair.repairOrder.estimator,
    ),
    roNumber: repair.repairOrder.roNumber,
    vehicle: repair.repairOrder.vehicle,
    stage: repair.repairOrder.stage,
    laborHours: repair.repairOrder.laborHours,
    preTaxTotal: repair.repairOrder.preTaxTotal,
    daysOnSite: repair.health.daysOnSite,
    healthScore: repair.health.healthScore,
    priorityScore: repair.health.priorityScore,
    riskLevel: repair.health.riskLevel,
    nextAction: repair.health.nextAction,
  };
}

export function buildEstimatorLoadSnapshot(
  intelligence: IntelligenceSnapshot,
): EstimatorLoadSnapshot {
  const grouped = new Map<string, RepairIntelligence[]>();

  for (const repair of intelligence.repairs) {
    const estimator = normalizeEstimator(
      repair.repairOrder.estimator,
    );

    const key = `${repair.repairOrder.shop}::${estimator}`;
    const current = grouped.get(key) || [];
    current.push(repair);
    grouped.set(key, current);
  }

  const preliminary = Array.from(
    grouped.entries(),
  ).map(([id, repairs]) => {
    const shop = repairs[0].repairOrder.shop;
    const estimator = normalizeEstimator(
      repairs[0].repairOrder.estimator,
    );

    const activeRepairs = repairs.filter(
      (repair) => repair.isActiveProduction,
    );

    const totalLaborHours = activeRepairs.reduce(
      (total, repair) =>
        total + repair.repairOrder.laborHours,
      0,
    );

    const highRiskRepairCount = repairs.filter(
      (repair) =>
        repair.health.riskLevel === "Critical" ||
        repair.health.riskLevel === "High",
    ).length;

    const criticalRepairCount = repairs.filter(
      (repair) =>
        repair.health.riskLevel === "Critical",
    ).length;

    const productionHoldCount = repairs.filter(
      (repair) => repair.isProductionHold,
    ).length;

    const backOrderedPartsCount = repairs.filter(
      (repair) => repair.isBackOrderedParts,
    ).length;

    const agingRepairCount = repairs.filter(
      (repair) =>
        repair.health.daysOnSite !== null &&
        repair.health.daysOnSite >= 20,
    ).length;

    const workloadScore = calculateWorkloadScore(
      repairs.length,
      totalLaborHours,
      highRiskRepairCount,
      productionHoldCount,
      backOrderedPartsCount,
      agingRepairCount,
    );

    return {
      id,
      shop,
      estimator,
      repairs,
      activeRepairs,
      totalLaborHours,
      highRiskRepairCount,
      criticalRepairCount,
      productionHoldCount,
      backOrderedPartsCount,
      agingRepairCount,
      workloadScore,
    };
  });

  const shopAverages = new Map<string, number>();

  for (const item of preliminary) {
    if (item.estimator === "Unassigned") continue;

    const peers = preliminary.filter(
      (candidate) =>
        candidate.shop === item.shop &&
        candidate.estimator !== "Unassigned",
    );

    const average =
      peers.length > 0
        ? peers.reduce(
            (total, peer) =>
              total + peer.workloadScore,
            0,
          ) / peers.length
        : item.workloadScore;

    shopAverages.set(item.shop, average);
  }

  const estimators: EstimatorLoad[] =
    preliminary.map((item) => {
      const teamAverageScore =
        shopAverages.get(item.shop) ||
        item.workloadScore ||
        1;

      const estimatorSettings =
        getEstimatorSettings(
          item.shop,
          item.estimator,
        );

      const availabilityFactor =
        Math.max(
          0,
          estimatorSettings.weeklyAvailabilityHours,
        ) / 40;

      const ptoFactor =
        Math.max(
          0,
          1 -
            estimatorSettings.ptoDaysThisWeek /
              5,
        );

      const adjustedFileCapacity =
        estimatorSettings.active
          ? Math.max(
              1,
              estimatorSettings.expectedFileCapacity *
                availabilityFactor *
                ptoFactor *
                estimatorSettings.workloadAdjustment,
            )
          : 1;

      const capacityIndexPercent =
        item.estimator === "Unassigned"
          ? 0
          : (item.repairs.length /
              adjustedFileCapacity) *
            100;

      const complexityIndexPercent =
        item.estimator === "Unassigned"
          ? 0
          : (item.workloadScore /
              teamAverageScore) *
            100;

      const workloadIndexPercent =
        item.estimator === "Unassigned"
          ? 0
          : capacityIndexPercent * 0.55 +
            complexityIndexPercent * 0.45;

      const status =
        !estimatorSettings.active &&
        item.estimator !== "Unassigned"
          ? "Overloaded"
          : getStatus(
              item.estimator,
              workloadIndexPercent,
            );

      return {
        id: item.id,
        shop: item.shop,
        estimator: item.estimator,
        role: estimatorSettings.role,
        supplementResponsibility:
          estimatorSettings.supplementResponsibility,
        configuredFileCapacity:
          estimatorSettings.expectedFileCapacity,
        adjustedFileCapacity,
        openRepairCount: item.repairs.length,
        activeRepairCount:
          item.activeRepairs.length,
        totalLaborHours: item.totalLaborHours,
        openRepairValue: item.repairs.reduce(
          (total, repair) =>
            total +
            repair.repairOrder.preTaxTotal,
          0,
        ),
        highRiskRepairCount:
          item.highRiskRepairCount,
        criticalRepairCount:
          item.criticalRepairCount,
        productionHoldCount:
          item.productionHoldCount,
        backOrderedPartsCount:
          item.backOrderedPartsCount,
        agingRepairCount:
          item.agingRepairCount,
        workloadScore: item.workloadScore,
        teamAverageScore,
        workloadIndexPercent,
        status,
        recommendation: getRecommendation(
          item.estimator,
          status,
          item.repairs.length,
          item.highRiskRepairCount,
          item.productionHoldCount,
          item.backOrderedPartsCount,
          item.agingRepairCount,
        ),
        repairs: item.repairs
          .map(toRepairSummary)
          .sort(
            (a, b) =>
              b.priorityScore -
              a.priorityScore,
          ),
      };
    });

  const statusRank: Record<
    EstimatorLoadStatus,
    number
  > = {
    Unassigned: 5,
    Overloaded: 4,
    Heavy: 3,
    Balanced: 2,
    Light: 1,
  };

  estimators.sort((a, b) => {
    const statusDifference =
      statusRank[b.status] -
      statusRank[a.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return (
      b.workloadIndexPercent -
      a.workloadIndexPercent
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    estimators,
    summary: {
      estimatorCount: estimators.filter(
        (estimator) =>
          estimator.status !== "Unassigned",
      ).length,
      openRepairCount:
        intelligence.repairs.length,
      activeRepairCount:
        intelligence.summary.activeRepairCount,
      totalLaborHours:
        intelligence.summary.activeLaborHours,
      openRepairValue:
        intelligence.summary.openRepairValue,
      overloadedEstimatorCount:
        estimators.filter(
          (estimator) =>
            estimator.status === "Overloaded",
        ).length,
      heavyEstimatorCount:
        estimators.filter(
          (estimator) =>
            estimator.status === "Heavy",
        ).length,
      unassignedRepairCount:
        estimators
          .filter(
            (estimator) =>
              estimator.status === "Unassigned",
          )
          .reduce(
            (total, estimator) =>
              total +
              estimator.openRepairCount,
            0,
          ),
    },
  };
}
