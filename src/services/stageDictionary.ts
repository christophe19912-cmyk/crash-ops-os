export type StageCategory =
  | "Pre-Production"
  | "Production"
  | "Parts"
  | "Parts Blocker"
  | "Flow Blocker"
  | "Delivery"
  | "Unknown";

export type BlockerType =
  | "None"
  | "Waiting on Parts"
  | "Back Ordered Parts"
  | "Production Hold"
  | "Delivery Closeout"
  | "Unknown";

export type StageDefinition = {
  code: string;
  name: string;
  category: StageCategory;
  blocker: BlockerType;
  countsAsActiveProduction: boolean;
  countsAsCompleted: boolean;
  defaultOwner: string;
  defaultAction: string;
};

const stageDefinitions: Record<string, StageDefinition> = {
  ARRIVAL: {
    code: "Arrival",
    name: "Arrived / Pre-Production",
    category: "Pre-Production",
    blocker: "None",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Estimator / Production Manager",
    defaultAction:
      "Confirm check-in is complete and schedule blueprint or initial repair planning.",
  },

  BP: {
    code: "BP",
    name: "Blueprint",
    category: "Production",
    blocker: "None",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Estimator / Blueprint Team",
    defaultAction:
      "Complete disassembly, repair planning, documentation, and parts identification.",
  },

  PO: {
    code: "PO",
    name: "Parts Ordered",
    category: "Parts",
    blocker: "Waiting on Parts",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Parts Coordinator",
    defaultAction:
      "Verify all required parts were ordered and confirm expected arrival dates.",
  },

  BOP: {
    code: "BOP",
    name: "Back Ordered Parts",
    category: "Parts Blocker",
    blocker: "Back Ordered Parts",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Parts Coordinator / Estimator",
    defaultAction:
      "Confirm ETA, investigate alternate sourcing, update the customer, and review the delivery date.",
  },

  HOLD: {
    code: "HOLD",
    name: "Production Hold",
    category: "Flow Blocker",
    blocker: "Production Hold",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "GM / Production Manager",
    defaultAction:
      "Identify the reason the repair is stopped, assign an owner, and establish the next required action.",
  },

  HLD: {
    code: "HLD",
    name: "Production Hold",
    category: "Flow Blocker",
    blocker: "Production Hold",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "GM / Production Manager",
    defaultAction:
      "Identify the reason the repair is stopped, assign an owner, and establish the next required action.",
  },

  BODY: {
    code: "Body",
    name: "Body Repair",
    category: "Production",
    blocker: "None",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Body Technician / Production Manager",
    defaultAction:
      "Confirm assigned labor is progressing and identify any parts, procedure, or staffing constraint.",
  },

  PNT: {
    code: "PNT",
    name: "Paint",
    category: "Production",
    blocker: "None",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Paint Team / Production Manager",
    defaultAction:
      "Protect booth flow and verify repairs are fully ready before entering paint.",
  },

  RSSMB: {
    code: "RSSMB",
    name: "Reassembly",
    category: "Production",
    blocker: "None",
    countsAsActiveProduction: true,
    countsAsCompleted: false,
    defaultOwner: "Technician / Production Manager",
    defaultAction:
      "Confirm all parts are available and prepare the repair for final QC and delivery.",
  },

  "C/HLD": {
    code: "C/HLD",
    name: "Completed / Delivery Hold",
    category: "Delivery",
    blocker: "Delivery Closeout",
    countsAsActiveProduction: false,
    countsAsCompleted: true,
    defaultOwner: "CSR / Estimator / GM",
    defaultAction:
      "Complete final authorization, payment, paperwork, customer contact, and pickup coordination.",
  },
};

function normalizeStageCode(stage: string) {
  return stage.trim().toUpperCase();
}

export function getStageDefinition(
  stage: string,
): StageDefinition {
  const normalized = normalizeStageCode(stage);

  return (
    stageDefinitions[normalized] || {
      code: stage || "Unknown",
      name: stage || "Unknown Stage",
      category: "Unknown",
      blocker: "Unknown",
      countsAsActiveProduction: true,
      countsAsCompleted: false,
      defaultOwner: "Management Review",
      defaultAction:
        "Review this stage and add it to the Crash Ops operations dictionary.",
    }
  );
}

export function isProductionHold(stage: string) {
  return getStageDefinition(stage).blocker === "Production Hold";
}

export function isBackOrderedParts(stage: string) {
  return (
    getStageDefinition(stage).blocker ===
    "Back Ordered Parts"
  );
}

export function isPartsOrdered(stage: string) {
  return normalizeStageCode(stage) === "PO";
}

export function isCompletedHold(stage: string) {
  return getStageDefinition(stage).countsAsCompleted;
}

export function isBlockedRepair(stage: string) {
  const blocker = getStageDefinition(stage).blocker;

  return (
    blocker === "Production Hold" ||
    blocker === "Back Ordered Parts"
  );
}
