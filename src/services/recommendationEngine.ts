import type { RepairOrder } from "../models/RepairOrder";
import { daysSince } from "./importedData";
import {
  getStageDefinition,
  isBackOrderedParts,
  isCompletedHold,
  isProductionHold,
} from "./stageDictionary";

export type OperationalPriority =
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

export type OperationalRecommendation = {
  id: string;
  priority: OperationalPriority;
  shop: string;
  roNumber: string;
  vehicle: string;
  stage: string;
  title: string;
  action: string;
  reason: string;
  owner: string;
  blocker: string;
  daysOnSite: number | null;
  laborHours: number;
};

function priorityScore(priority: OperationalPriority) {
  return {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  }[priority];
}

export function buildOperationalRecommendations(
  repairOrders: RepairOrder[],
): OperationalRecommendation[] {
  const recommendations: OperationalRecommendation[] = [];

  repairOrders.forEach((order) => {
    const stage = getStageDefinition(order.stage);
    const age = daysSince(order.arrivalDate);

    if (isProductionHold(order.stage)) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-production-hold`,
        priority: age !== null && age >= 10 ? "Critical" : "High",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Resolve production hold",
        action: stage.defaultAction,
        reason:
          age === null
            ? `RO ${order.roNumber} is in a production-hold stage.`
            : `RO ${order.roNumber} is in a production-hold stage and has been onsite for ${age} days.`,
        owner: stage.defaultOwner,
        blocker: stage.blocker,
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }

    if (isBackOrderedParts(order.stage)) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-backordered-parts`,
        priority: age !== null && age >= 14 ? "Critical" : "High",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Escalate back-ordered parts",
        action: stage.defaultAction,
        reason:
          age === null
            ? `RO ${order.roNumber} is stopped for back-ordered parts.`
            : `RO ${order.roNumber} is stopped for back-ordered parts and has been onsite for ${age} days.`,
        owner: stage.defaultOwner,
        blocker: stage.blocker,
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }

    if (isCompletedHold(order.stage)) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-delivery-closeout`,
        priority: age !== null && age >= 20 ? "High" : "Medium",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Complete delivery closeout",
        action: stage.defaultAction,
        reason:
          "Repairs are complete, but the vehicle remains onsite awaiting pickup, final authorization, payment, paperwork, or release.",
        owner: stage.defaultOwner,
        blocker: stage.blocker,
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }

    if (
      order.stage.trim().toUpperCase() === "BP" &&
      order.laborHours >= 35
    ) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-large-blueprint`,
        priority: "High",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Prioritize large blueprint",
        action:
          "Complete blueprint, repair planning, documentation, and parts identification before assigning additional large repairs.",
        reason: `This repair carries ${order.laborHours.toFixed(
          1,
        )} labor hours and remains in Blueprint.`,
        owner: "Estimator / Blueprint Team",
        blocker: "Potential Planning Delay",
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }

    if (
      order.technician === "Unassigned" &&
      !isCompletedHold(order.stage)
    ) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-missing-technician`,
        priority: "Medium",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Assign repair ownership",
        action:
          "Confirm the responsible technician or production owner before the morning WIP walk is completed.",
        reason:
          "The imported WIP report does not show an assigned service resource for this active repair.",
        owner: "Production Manager",
        blocker: "Missing Assignment",
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }

    if (
      age !== null &&
      age >= 20 &&
      !isCompletedHold(order.stage) &&
      !isProductionHold(order.stage) &&
      !isBackOrderedParts(order.stage)
    ) {
      recommendations.push({
        id: `${order.shop}-${order.roNumber}-aging-review`,
        priority: "High",
        shop: order.shop,
        roNumber: order.roNumber,
        vehicle: order.vehicle,
        stage: order.stage,
        title: "Review aging active repair",
        action:
          "Review the repair during the morning WIP walk, confirm the next production movement, and document any blocker.",
        reason: `This active repair has been onsite for ${age} days.`,
        owner: "GM / Production Manager",
        blocker: "Aging / Unknown Delay",
        daysOnSite: age,
        laborHours: order.laborHours,
      });
    }
  });

  return recommendations.sort((a, b) => {
    const priorityDifference =
      priorityScore(b.priority) -
      priorityScore(a.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (b.daysOnSite || 0) - (a.daysOnSite || 0);
  });
}
