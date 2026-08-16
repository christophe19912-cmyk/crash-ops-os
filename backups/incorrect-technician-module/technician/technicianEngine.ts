import type {
  IntelligenceSnapshot,
  RepairIntelligence,
} from "../intelligence";
import { getCapacitySettings } from "../../services/capacitySettings";
import type {
  TechnicianLoad,
  TechnicianLoadSnapshot,
  TechnicianLoadStatus,
} from "./technicianTypes";

function normalizeTechnician(name: string) {
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

function getStatus(
  technician: string,
  utilizationPercent: number,
): TechnicianLoadStatus {
  if (technician === "Unassigned") return "Unassigned";
  if (utilizationPercent < 80) return "Available";
  if (utilizationPercent <= 100) return "Balanced";
  if (utilizationPercent <= 115) return "Near Capacity";
  return "Overloaded";
}

function getRecommendation(
  technician: string,
  status: TechnicianLoadStatus,
  remainingCapacityHours: number,
  overloadHours: number,
  highRiskRepairCount: number,
  productionHoldCount: number,
) {
  if (technician === "Unassigned") {
    return "Assign ownership to these repairs before adding more work to the shop.";
  }

  if (status === "Overloaded") {
    return `Reassign or delay approximately ${overloadHours.toFixed(
      1,
    )} labor hours. Protect high-priority completions before adding new work.`;
  }

  if (status === "Near Capacity") {
    return "Avoid assigning another heavy repair. Review projected completions before adding work.";
  }

  if (productionHoldCount > 0) {
    return `Resolve ${productionHoldCount} production hold${
      productionHoldCount === 1 ? "" : "s"
    } before increasing assigned workload.`;
  }

  if (highRiskRepairCount > 0) {
    return `Prioritize ${highRiskRepairCount} high-risk repair${
      highRiskRepairCount === 1 ? "" : "s"
    } before accepting additional assignments.`;
  }

  if (status === "Available") {
    return `Approximately ${Math.max(
      0,
      remainingCapacityHours,
    ).toFixed(1)} labor hours remain available at the current weekly target.`;
  }

  return "Workload is balanced. Maintain the current assignment pace and monitor completions.";
}

function toRepairSummary(repair: RepairIntelligence) {
  return {
    shop: repair.repairOrder.shop,
    technician: normalizeTechnician(
      repair.repairOrder.technician,
    ),
    roNumber: repair.repairOrder.roNumber,
    vehicle: repair.repairOrder.vehicle,
    stage: repair.repairOrder.stage,
    laborHours: repair.repairOrder.laborHours,
    healthScore: repair.health.healthScore,
    priorityScore: repair.health.priorityScore,
    riskLevel: repair.health.riskLevel,
    nextAction: repair.health.nextAction,
  };
}

export function buildTechnicianLoadSnapshot(
  intelligence: IntelligenceSnapshot,
): TechnicianLoadSnapshot {
  const activeRepairs = intelligence.repairs.filter(
    (repair) => repair.isActiveProduction,
  );

  const grouped = new Map<string, RepairIntelligence[]>();

  for (const repair of activeRepairs) {
    const technician = normalizeTechnician(
      repair.repairOrder.technician,
    );

    const key = `${repair.repairOrder.shop}::${technician}`;
    const current = grouped.get(key) || [];
    current.push(repair);
    grouped.set(key, current);
  }

  const technicians: TechnicianLoad[] = Array.from(
    grouped.entries(),
  ).map(([id, repairs]) => {
    const shop = repairs[0].repairOrder.shop;
    const technician = normalizeTechnician(
      repairs[0].repairOrder.technician,
    );

    const settings = getCapacitySettings(shop);

    const weeklyCapacityHours =
      technician === "Unassigned"
        ? 0
        : settings.productiveTechnicians > 0
          ? settings.weeklyLaborOutputTarget /
            settings.productiveTechnicians
          : settings.weeklyLaborOutputTarget;

    const assignedLaborHours = repairs.reduce(
      (total, repair) =>
        total + repair.repairOrder.laborHours,
      0,
    );

    const utilizationPercent =
      weeklyCapacityHours > 0
        ? (assignedLaborHours / weeklyCapacityHours) * 100
        : 0;

    const remainingCapacityHours =
      weeklyCapacityHours - assignedLaborHours;

    const status = getStatus(
      technician,
      utilizationPercent,
    );

    const highRiskRepairCount = repairs.filter(
      (repair) =>
        repair.health.riskLevel === "Critical" ||
        repair.health.riskLevel === "High",
    ).length;

    const productionHoldCount = repairs.filter(
      (repair) => repair.isProductionHold,
    ).length;

    const backOrderedPartsCount = repairs.filter(
      (repair) => repair.isBackOrderedParts,
    ).length;

    return {
      id,
      shop,
      technician,
      assignedRepairCount: repairs.length,
      assignedLaborHours,
      weeklyCapacityHours,
      remainingCapacityHours,
      utilizationPercent,
      highRiskRepairCount,
      productionHoldCount,
      backOrderedPartsCount,
      status,
      recommendation: getRecommendation(
        technician,
        status,
        remainingCapacityHours,
        Math.max(0, -remainingCapacityHours),
        highRiskRepairCount,
        productionHoldCount,
      ),
      repairs: repairs
        .map(toRepairSummary)
        .sort(
          (a, b) =>
            b.priorityScore - a.priorityScore,
        ),
    };
  });

  technicians.sort((a, b) => {
    const statusRank: Record<
      TechnicianLoadStatus,
      number
    > = {
      Unassigned: 5,
      Overloaded: 4,
      "Near Capacity": 3,
      Balanced: 2,
      Available: 1,
    };

    const statusDifference =
      statusRank[b.status] - statusRank[a.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return b.utilizationPercent - a.utilizationPercent;
  });

  const unassigned = technicians.filter(
    (technician) =>
      technician.status === "Unassigned",
  );

  return {
    generatedAt: new Date().toISOString(),
    technicians,
    summary: {
      technicianCount: technicians.filter(
        (technician) =>
          technician.status !== "Unassigned",
      ).length,
      assignedRepairCount: activeRepairs.length,
      assignedLaborHours: activeRepairs.reduce(
        (total, repair) =>
          total + repair.repairOrder.laborHours,
        0,
      ),
      availableTechnicianCount: technicians.filter(
        (technician) =>
          technician.status === "Available",
      ).length,
      overloadedTechnicianCount: technicians.filter(
        (technician) =>
          technician.status === "Overloaded" ||
          technician.status === "Near Capacity",
      ).length,
      unassignedRepairCount: unassigned.reduce(
        (total, technician) =>
          total + technician.assignedRepairCount,
        0,
      ),
      unassignedLaborHours: unassigned.reduce(
        (total, technician) =>
          total + technician.assignedLaborHours,
        0,
      ),
    },
  };
}
