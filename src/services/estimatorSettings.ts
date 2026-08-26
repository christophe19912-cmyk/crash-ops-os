import type {
  EstimatorRole,
  EstimatorSettings,
} from "../models/EstimatorSettings";
import { supabase } from "../lib/supabase";
import {
  cloudPersistenceError,
  findCloudShop,
  loadCloudTenantContext,
} from "./cloudPersistence";

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

type EstimatorSettingsRow = {
  shop_id: string;
  estimator_name: string;
  role: EstimatorRole;
  weekly_availability_hours: number | string;
  expected_file_capacity: number | string;
  supplement_responsibility: boolean;
  pto_days_this_week: number | string;
  is_active: boolean;
  workload_adjustment: number | string;
};

export async function loadEstimatorSettingsFromCloud(
  discovered: Array<{ shop: string; estimator: string }> = [],
): Promise<EstimatorSettings[]> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return seedEstimatorSettings(discovered);

  const { data, error } = await supabase
    .from("estimator_settings")
    .select("shop_id, estimator_name, role, weekly_availability_hours, expected_file_capacity, supplement_responsibility, pto_days_this_week, is_active, workload_adjustment")
    .returns<EstimatorSettingsRow[]>();

  if (error) throw cloudPersistenceError(error, "Estimator settings could not be loaded");

  const shopNames = new Map(context.shops.map((shop) => [shop.id, shop.name]));
  const cloudSettings = (data ?? []).flatMap((row) => {
    const shop = shopNames.get(row.shop_id);
    if (!shop) return [];
    return [{
      id: buildId(shop, row.estimator_name),
      shop,
      estimator: row.estimator_name,
      role: row.role,
      weeklyAvailabilityHours: Number(row.weekly_availability_hours),
      expectedFileCapacity: Number(row.expected_file_capacity),
      supplementResponsibility: row.supplement_responsibility,
      ptoDaysThisWeek: Number(row.pto_days_this_week),
      active: row.is_active,
      workloadAdjustment: Number(row.workload_adjustment),
    } satisfies EstimatorSettings];
  });

  const merged = new Map(cloudSettings.map((setting) => [setting.id, setting]));
  for (const pair of discovered) {
    const defaults = createDefaultEstimatorSettings(pair.shop, pair.estimator);
    if (!merged.has(defaults.id)) merged.set(defaults.id, defaults);
  }

  const settings = Array.from(merged.values());
  saveEstimatorSettings(settings);
  return settings;
}

export async function saveEstimatorSettingToCloud(settings: EstimatorSettings): Promise<void> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return;
  const shop = findCloudShop(context.shops, settings.shop);

  const { error } = await supabase.from("estimator_settings").upsert(
    {
      organization_id: context.organizationId,
      shop_id: shop.id,
      estimator_name: settings.estimator,
      role: settings.role,
      weekly_availability_hours: settings.weeklyAvailabilityHours,
      expected_file_capacity: settings.expectedFileCapacity,
      supplement_responsibility: settings.supplementResponsibility,
      pto_days_this_week: settings.ptoDaysThisWeek,
      is_active: settings.active,
      workload_adjustment: settings.workloadAdjustment,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,estimator_name" },
  );

  if (error) throw cloudPersistenceError(error, "Estimator setting could not be saved");
}
