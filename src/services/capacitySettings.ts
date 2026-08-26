import type {
  CapacitySettingsStore,
  ShopCapacitySettings,
} from "../models/CapacitySettings";
import { supabase } from "../lib/supabase";
import {
  cloudPersistenceError,
  findCloudShop,
  loadCloudTenantContext,
} from "./cloudPersistence";

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

type CapacitySettingsRow = {
  shop_id: string;
  productive_technicians: number | string;
  weekly_labor_output_target: number | string;
  monthly_labor_output_target?: number | string | null;
  productive_workdays_per_month?: number | string | null;
  bays: number | string;
  target_touch_time: number | string;
  target_cycle_time_days: number | string;
  healthy_wip_weeks?: number | string | null;
  maximum_wip_weeks?: number | string | null;
  average_labor_hours_per_drop?: number | string | null;
  maximum_daily_drops?: number | string | null;
  scheduling_buffer_percent?: number | string | null;
  updated_at?: string | null;
};

function numeric(value: number | string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadCapacitySettingsFromCloud(): Promise<CapacitySettingsStore> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return loadCapacitySettings();

  const { data, error } = await supabase
    .from("capacity_settings")
    .select("*")
    .returns<CapacitySettingsRow[]>();

  if (error) throw cloudPersistenceError(error, "Capacity settings could not be loaded");

  const shopNames = new Map(context.shops.map((shop) => [shop.id, shop.name]));
  const store = { ...loadCapacitySettings() };

  for (const row of data ?? []) {
    const shop = shopNames.get(row.shop_id);
    if (!shop) continue;
    const defaults = createDefaultCapacitySettings(shop);
    store[shop] = {
      ...defaults,
      weeklyLaborOutputTarget: numeric(row.weekly_labor_output_target, defaults.weeklyLaborOutputTarget),
      monthlyLaborOutputTarget: numeric(row.monthly_labor_output_target, defaults.monthlyLaborOutputTarget),
      productiveWorkdaysPerMonth: numeric(row.productive_workdays_per_month, defaults.productiveWorkdaysPerMonth),
      targetTouchTimeHours: numeric(row.target_touch_time, defaults.targetTouchTimeHours),
      targetCycleTimeDays: numeric(row.target_cycle_time_days, defaults.targetCycleTimeDays),
      healthyWipWeeks: numeric(row.healthy_wip_weeks, defaults.healthyWipWeeks),
      maximumWipWeeks: numeric(row.maximum_wip_weeks, defaults.maximumWipWeeks),
      productiveTechnicians: numeric(row.productive_technicians, defaults.productiveTechnicians),
      productiveBays: numeric(row.bays, defaults.productiveBays),
      averageLaborHoursPerDrop: numeric(row.average_labor_hours_per_drop, defaults.averageLaborHoursPerDrop),
      maximumDailyDrops: numeric(row.maximum_daily_drops, defaults.maximumDailyDrops),
      schedulingBufferPercent: numeric(row.scheduling_buffer_percent, defaults.schedulingBufferPercent),
      updatedAt: row.updated_at ?? defaults.updatedAt,
    };
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

export async function saveCapacitySettingsToCloud(
  settings: ShopCapacitySettings,
): Promise<ShopCapacitySettings> {
  const saved = saveCapacitySettings(settings);
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return saved;
  const shop = findCloudShop(context.shops, settings.shop);

  const { error } = await supabase.from("capacity_settings").upsert(
    {
      organization_id: context.organizationId,
      shop_id: shop.id,
      productive_technicians: saved.productiveTechnicians,
      weekly_labor_output_target: saved.weeklyLaborOutputTarget,
      monthly_labor_output_target: saved.monthlyLaborOutputTarget,
      productive_workdays_per_month: saved.productiveWorkdaysPerMonth,
      bays: saved.productiveBays,
      target_touch_time: saved.targetTouchTimeHours,
      target_cycle_time_days: saved.targetCycleTimeDays,
      healthy_wip_weeks: saved.healthyWipWeeks,
      maximum_wip_weeks: saved.maximumWipWeeks,
      average_labor_hours_per_drop: saved.averageLaborHoursPerDrop,
      maximum_daily_drops: saved.maximumDailyDrops,
      scheduling_buffer_percent: saved.schedulingBufferPercent,
      updated_by: context.user.id,
      updated_at: saved.updatedAt,
    },
    { onConflict: "shop_id" },
  );

  if (error) throw cloudPersistenceError(error, "Capacity settings could not be saved");
  return saved;
}

export async function resetCapacitySettingsInCloud(shop: string) {
  return saveCapacitySettingsToCloud(createDefaultCapacitySettings(shop));
}
