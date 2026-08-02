import type {
  CapacitySettingsStore,
  ShopCapacitySettings,
} from "../models/CapacitySettings";

const STORAGE_KEY = "crashOpsCapacitySettings";

export const SHOP_OPTIONS = [
  "Monroeville",
  "Greensburg",
  "North Hills",
  "North Huntingdon",
  "Canonsburg",
];

export function createDefaultCapacitySettings(
  shop: string,
): ShopCapacitySettings {
  return {
    shop,
    weeklyLaborOutputTarget: 350,
    monthlyLaborOutputTarget: 1400,
    productiveWorkdaysPerMonth: 20,
    targetTouchTimeHours: 4,
    targetCycleTimeDays: 12,
    healthyWipWeeks: 2.5,
    maximumWipWeeks: 3.5,
    productiveTechnicians: 6,
    productiveBays: 12,
    averageLaborHoursPerDrop: 34,
    maximumDailyDrops: 4,
    schedulingBufferPercent: 10,
    updatedAt: new Date().toISOString(),
  };
}

export function loadCapacitySettings(): CapacitySettingsStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return {};

    return JSON.parse(stored) as CapacitySettingsStore;
  } catch {
    return {};
  }
}

export function getCapacitySettings(
  shop: string,
): ShopCapacitySettings {
  const stored = loadCapacitySettings();

  return stored[shop] || createDefaultCapacitySettings(shop);
}

export function saveCapacitySettings(
  settings: ShopCapacitySettings,
) {
  const stored = loadCapacitySettings();

  const updatedSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  const nextStore: CapacitySettingsStore = {
    ...stored,
    [settings.shop]: updatedSettings,
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(nextStore),
  );

  return updatedSettings;
}

export function resetCapacitySettings(shop: string) {
  const defaults = createDefaultCapacitySettings(shop);
  return saveCapacitySettings(defaults);
}
