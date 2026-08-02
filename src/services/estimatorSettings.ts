import type {
  EstimatorRole,
  EstimatorSettings,
} from "../models/EstimatorSettings";

const STORAGE_KEY = "crashOpsEstimatorSettings";

export const ESTIMATOR_ROLES: EstimatorRole[] = [
  "Primary Estimator",
  "Supplement Estimator",
  "Manager",
  "CSR",
];

function buildId(shop: string, estimator: string) {
  return `${shop}::${estimator}`;
}

export function createDefaultEstimatorSettings(
  shop: string,
  estimator: string,
): EstimatorSettings {
  return {
    id: buildId(shop, estimator),
    shop,
    estimator,
    role: "Primary Estimator",
    weeklyAvailabilityHours: 40,
    expectedFileCapacity: 20,
    supplementResponsibility: false,
    ptoDaysThisWeek: 0,
    active: true,
    workloadAdjustment: 1,
  };
}

export function loadEstimatorSettings(): EstimatorSettings[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? (parsed as EstimatorSettings[])
      : [];
  } catch {
    return [];
  }
}

export function saveEstimatorSettings(
  settings: EstimatorSettings[],
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings),
  );
}

export function getEstimatorSettings(
  shop: string,
  estimator: string,
): EstimatorSettings {
  return (
    loadEstimatorSettings().find(
      (setting) =>
        setting.shop === shop &&
        setting.estimator === estimator,
    ) ||
    createDefaultEstimatorSettings(
      shop,
      estimator,
    )
  );
}

export function upsertEstimatorSettings(
  current: EstimatorSettings[],
  updated: EstimatorSettings,
) {
  const exists = current.some(
    (setting) => setting.id === updated.id,
  );

  const next = exists
    ? current.map((setting) =>
        setting.id === updated.id
          ? updated
          : setting,
      )
    : [...current, updated];

  saveEstimatorSettings(next);
  return next;
}

export function seedEstimatorSettings(
  pairs: Array<{
    shop: string;
    estimator: string;
  }>,
) {
  const current = loadEstimatorSettings();
  const next = [...current];

  for (const pair of pairs) {
    const id = buildId(
      pair.shop,
      pair.estimator,
    );

    if (
      !next.some(
        (setting) => setting.id === id,
      )
    ) {
      next.push(
        createDefaultEstimatorSettings(
          pair.shop,
          pair.estimator,
        ),
      );
    }
  }

  saveEstimatorSettings(next);
  return next;
}
