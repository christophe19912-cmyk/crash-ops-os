import type {
  TechnicianRole,
  TechnicianSettings,
} from "../models/TechnicianSettings";
import { supabase } from "../lib/supabase";
import {
  cloudPersistenceError,
  findCloudShop,
  loadCloudTenantContext,
} from "./cloudPersistence";

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

type TechnicianSettingsRow = {
  shop_id: string;
  technician_name: string;
  role: TechnicianRole;
  weekly_labor_target: number | string;
  weekly_availability_hours: number | string;
  pto_days_this_week: number | string;
  is_active: boolean;
  capacity_adjustment: number | string;
};

export async function loadTechnicianSettingsFromCloud(
  discovered: Array<{ shop: string; technician: string }> = [],
): Promise<TechnicianSettings[]> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return seedTechnicianSettings(discovered);

  const { data, error } = await supabase
    .from("technician_settings")
    .select("shop_id, technician_name, role, weekly_labor_target, weekly_availability_hours, pto_days_this_week, is_active, capacity_adjustment")
    .returns<TechnicianSettingsRow[]>();

  if (error) throw cloudPersistenceError(error, "Technician settings could not be loaded");

  const shopNames = new Map(context.shops.map((shop) => [shop.id, shop.name]));
  const cloudSettings = (data ?? []).flatMap((row) => {
    const shop = shopNames.get(row.shop_id);
    if (!shop) return [];
    return [{
      id: buildId(shop, row.technician_name),
      shop,
      technician: row.technician_name,
      role: row.role,
      weeklyLaborTarget: Number(row.weekly_labor_target),
      weeklyAvailabilityHours: Number(row.weekly_availability_hours),
      ptoDaysThisWeek: Number(row.pto_days_this_week),
      active: row.is_active,
      capacityAdjustment: Number(row.capacity_adjustment),
    } satisfies TechnicianSettings];
  });

  const merged = new Map(cloudSettings.map((setting) => [setting.id, setting]));
  for (const pair of discovered) {
    const defaults = createDefaultTechnicianSettings(pair.shop, pair.technician);
    if (!merged.has(defaults.id)) merged.set(defaults.id, defaults);
  }

  const settings = Array.from(merged.values());
  saveTechnicianSettings(settings);
  return settings;
}

export async function saveTechnicianSettingToCloud(settings: TechnicianSettings): Promise<void> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return;
  const shop = findCloudShop(context.shops, settings.shop);

  const { error } = await supabase.from("technician_settings").upsert(
    {
      organization_id: context.organizationId,
      shop_id: shop.id,
      technician_name: settings.technician,
      role: settings.role,
      weekly_labor_target: settings.weeklyLaborTarget,
      weekly_availability_hours: settings.weeklyAvailabilityHours,
      pto_days_this_week: settings.ptoDaysThisWeek,
      is_active: settings.active,
      capacity_adjustment: settings.capacityAdjustment,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,technician_name" },
  );

  if (error) throw cloudPersistenceError(error, "Technician setting could not be saved");
}
