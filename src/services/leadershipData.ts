import { supabase } from "../lib/supabase";
import type { ActionStatus } from "./operationsData";

export type LeadershipAction = {
  id: string;
  organization_id: string;
  shop_id: string;
  repair_order_id: string | null;
  title: string;
  description: string;
  action_type: string;
  priority: "critical" | "high" | "medium" | "low";
  assigned_to: string | null;
  source: string;
  due_at: string | null;
  status: ActionStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  dismissal_reason: string | null;
  metadata: Record<string, unknown>;
};

export type ShopOption = { id: string; name: string };
export type UserOption = { id: string; full_name: string | null; email: string | null };
export type RepairOrderRecord = {
  id: string; shop_id: string; ro_number: string; customer: string | null; vehicle: string | null;
  stage: string | null; estimator: string | null; arrival_date: string | null; updated_at: string;
};
export type TimelineEvent = {
  id: string; event_type: string; old_value: string | null; new_value: string | null;
  metadata: Record<string, unknown>; created_by: string | null; created_at: string;
};
export type ActionEventSummary = { action_item_id: string; event_type: string };

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadLeadershipData(): Promise<{
  actions: LeadershipAction[]; shops: ShopOption[]; users: UserOption[]; repairOrders: RepairOrderRecord[];
  actionEvents: ActionEventSummary[];
}> {
  const client = requireClient();
  const [actionsResult, shopsResult, usersResult, repairsResult, eventsResult] = await Promise.all([
    client.from("action_items").select("id, organization_id, shop_id, repair_order_id, title, description, action_type, priority, assigned_to, source, due_at, status, created_at, updated_at, completed_at, dismissal_reason, metadata").order("created_at", { ascending: false }).returns<LeadershipAction[]>(),
    client.from("shops").select("id, name").order("name").returns<ShopOption[]>(),
    client.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name").returns<UserOption[]>(),
    client.from("repair_orders").select("id, shop_id, ro_number, customer, vehicle, stage, estimator, arrival_date, updated_at").order("updated_at", { ascending: false }).returns<RepairOrderRecord[]>(),
    client.from("action_item_events").select("action_item_id, event_type").returns<ActionEventSummary[]>(),
  ]);
  const error = actionsResult.error ?? shopsResult.error ?? usersResult.error ?? repairsResult.error ?? eventsResult.error;
  if (error) throw error;
  return {
    actions: actionsResult.data ?? [], shops: shopsResult.data ?? [], users: usersResult.data ?? [],
    repairOrders: repairsResult.data ?? [], actionEvents: eventsResult.data ?? [],
  };
}

export async function updateActionAccountability(
  id: string,
  changes: { assigned_to?: string | null; due_at?: string | null; priority?: LeadershipAction["priority"] },
): Promise<void> {
  const { error } = await requireClient().from("action_items").update(changes).eq("id", id);
  if (error) throw error;
}

export async function loadRepairTimeline(repairOrderId: string): Promise<TimelineEvent[]> {
  const { data, error } = await requireClient().from("repair_order_events")
    .select("id, event_type, old_value, new_value, metadata, created_by, created_at")
    .eq("repair_order_id", repairOrderId).order("created_at", { ascending: false }).returns<TimelineEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function loadActionTimeline(actionItemId: string): Promise<TimelineEvent[]> {
  const { data, error } = await requireClient().from("action_item_events")
    .select("id, event_type, old_value, new_value, metadata, created_by, created_at")
    .eq("action_item_id", actionItemId).order("created_at", { ascending: false }).returns<TimelineEvent[]>();
  if (error) throw error;
  return data ?? [];
}

async function currentUserId(): Promise<string> {
  const { data } = await requireClient().auth.getUser();
  if (!data.user) throw new Error("Authentication is required.");
  return data.user.id;
}

export async function addActionNote(action: LeadershipAction, note: string): Promise<void> {
  const { error } = await requireClient().from("action_item_events").insert({
    organization_id: action.organization_id, shop_id: action.shop_id, action_item_id: action.id,
    event_type: "note_added", metadata: { note }, created_by: await currentUserId(),
  });
  if (error) throw error;
}

export async function addRepairNote(action: LeadershipAction, note: string): Promise<void> {
  if (!action.repair_order_id) throw new Error("This action is not linked to a repair order.");
  const { error } = await requireClient().from("repair_order_events").insert({
    organization_id: action.organization_id, shop_id: action.shop_id, repair_order_id: action.repair_order_id,
    event_type: "note_added", metadata: { note }, created_by: await currentUserId(),
  });
  if (error) throw error;
}

export function downloadLeadershipCsv(actions: LeadershipAction[], shops: ShopOption[], users: UserOption[]): void {
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]));
  const userNames = new Map(users.map((user) => [user.id, user.full_name ?? user.email ?? "Unknown"]));
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["Title", "Shop", "Priority", "Status", "Assignee", "Due", "Created", "Completed", "Type"],
    ...actions.map((item) => [item.title, shopNames.get(item.shop_id), item.priority, item.status,
      item.assigned_to ? userNames.get(item.assigned_to) : "Unassigned", item.due_at, item.created_at,
      item.completed_at, item.action_type])];
  const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `crash-ops-leadership-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
