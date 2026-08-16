import type {
  TechnicianRole,
  TechnicianSettings,
} from "../models/TechnicianSettings";

const STORAGE_KEY = "crashOpsTechnicianSettings";

export const TECHNICIAN_ROLES: TechnicianRole[] = [
  "Body Technician",
  "Structural Technician",
  "Combination Technician",
  "Apprentice",
  "Paint Technician",
];

function buildId(shop: string, technician: string) {
  return `${shop}::${technician}`;
}

export function createDefaultTechnicianSettings(
  shop: string,
  technician: string,
): TechnicianSettings {
  return {
    id: buildId(shop, technician),
    shop,
    technician,
    role: "Body Technician",
    weeklyLaborTarget: 40,
    weeklyAvailabilityHours: 40,
    ptoDaysThisWeek: 0,
    active: true,
    capacityAdjustment: 1,
  };
}

export function loadTechnicianSettings(): TechnicianSettings[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? (parsed as TechnicianSettings[])
      : [];
  } catch {
    return [];
  }
}

export function saveTechnicianSettings(
  settings: TechnicianSettings[],
) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function upsertTechnicianSettings(
  current: TechnicianSettings[],
  updated: TechnicianSettings,
) {
  const exists = current.some(
    (setting) => setting.id === updated.id,
  );

  const next = exists
    ? current.map((setting) =>
        setting.id === updated.id ? updated : setting,
      )
    : [...current, updated];

  saveTechnicianSettings(next);
  return next;
}

export function seedTechnicianSettings(
  pairs: Array<{ shop: string; technician: string }>,
) {
  const current = loadTechnicianSettings();
  const next = [...current];

  for (const pair of pairs) {
    const id = buildId(pair.shop, pair.technician);
    if (next.some((setting) => setting.id === id)) continue;

    next.push(
      createDefaultTechnicianSettings(
        pair.shop,
        pair.technician,
      ),
    );
  }

  saveTechnicianSettings(next);
  return next;
}
