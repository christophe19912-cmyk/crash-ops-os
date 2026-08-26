import type { ScheduledDrop, ScheduleDay } from "../models/ScheduledDrop";
import { supabase } from "../lib/supabase";
import {
  cloudPersistenceError,
  findCloudShop,
  loadCloudTenantContext,
} from "./cloudPersistence";

const STORAGE_KEY = "crashOpsScheduledDrops";
export const SCHEDULE_DAYS: ScheduleDay[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function loadScheduledDrops(): ScheduledDrop[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ScheduledDrop[]) : [];
  } catch {
    return [];
  }
}

function persist(drops: ScheduledDrop[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drops));
  return drops;
}

export function addScheduledDrop(drops: ScheduledDrop[], drop: Omit<ScheduledDrop, "id" | "createdAt">) {
  return persist([...drops, {
    ...drop,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
  }]);
}

export function updateScheduledDrop(drops: ScheduledDrop[], updated: ScheduledDrop) {
  return persist(drops.map((drop) => drop.id === updated.id ? updated : drop));
}

export function deleteScheduledDrop(drops: ScheduledDrop[], id: string) {
  return persist(drops.filter((drop) => drop.id !== id));
}

type ScheduledDropRow = {
  id: string;
  shop_id: string;
  scheduled_date: string;
  customer: string | null;
  vehicle: string | null;
  ro_number: string | null;
  estimated_labor_hours: number | string;
  severity: RepairSeverity | null;
  notes: string | null;
  created_at: string;
};

type RepairSeverity = ScheduledDrop["severity"];

function startOfWorkWeek(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(12, 0, 0, 0);
  return result;
}

function dateForDay(day: ScheduleDay) {
  const monday = startOfWorkWeek();
  monday.setDate(monday.getDate() + SCHEDULE_DAYS.indexOf(day));
  return monday.toISOString().slice(0, 10);
}

function dayForDate(value: string): ScheduleDay | null {
  const date = new Date(`${value}T12:00:00`);
  const index = date.getDay() - 1;
  return SCHEDULE_DAYS[index] ?? null;
}

export async function loadScheduledDropsFromCloud(): Promise<ScheduledDrop[]> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return loadScheduledDrops();
  const start = startOfWorkWeek();
  const end = new Date(start);
  end.setDate(end.getDate() + 4);

  const { data, error } = await supabase
    .from("scheduled_drops")
    .select("id, shop_id, scheduled_date, customer, vehicle, ro_number, estimated_labor_hours, severity, notes, created_at")
    .gte("scheduled_date", start.toISOString().slice(0, 10))
    .lte("scheduled_date", end.toISOString().slice(0, 10))
    .returns<ScheduledDropRow[]>();

  if (error) throw cloudPersistenceError(error, "Scheduled drops could not be loaded");
  const shopNames = new Map(context.shops.map((shop) => [shop.id, shop.name]));
  const drops = (data ?? []).flatMap((row) => {
    const shop = shopNames.get(row.shop_id);
    const day = dayForDate(row.scheduled_date);
    if (!shop || !day) return [];
    return [{
      id: row.id,
      shop,
      day,
      customer: row.customer ?? "Customer TBD",
      vehicle: row.vehicle ?? "Vehicle TBD",
      roNumber: row.ro_number ?? "Pending",
      estimatedLaborHours: Number(row.estimated_labor_hours),
      severity: row.severity ?? "Medium",
      notes: row.notes ?? "",
      createdAt: row.created_at,
    } satisfies ScheduledDrop];
  });

  persist(drops);
  return drops;
}

export async function saveScheduledDropToCloud(drop: ScheduledDrop): Promise<ScheduledDrop> {
  const context = await loadCloudTenantContext();
  if (!context || !supabase) return drop;
  const shop = findCloudShop(context.shops, drop.shop);
  const { data, error } = await supabase.from("scheduled_drops").upsert({
    id: drop.id,
    organization_id: context.organizationId,
    shop_id: shop.id,
    scheduled_date: dateForDay(drop.day),
    customer: drop.customer,
    vehicle: drop.vehicle,
    ro_number: drop.roNumber,
    estimated_labor_hours: drop.estimatedLaborHours,
    severity: drop.severity,
    notes: drop.notes,
    created_by: context.user.id,
    created_at: drop.createdAt,
    updated_at: new Date().toISOString(),
  }).select("id").single<{ id: string }>();

  if (error) throw cloudPersistenceError(error, "Scheduled drop could not be saved");
  return { ...drop, id: data.id };
}

export async function deleteScheduledDropFromCloud(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("scheduled_drops").delete().eq("id", id);
  if (error) throw cloudPersistenceError(error, "Scheduled drop could not be deleted");
}
