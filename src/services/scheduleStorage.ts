import type { ScheduledDrop, ScheduleDay } from "../models/ScheduledDrop";

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
