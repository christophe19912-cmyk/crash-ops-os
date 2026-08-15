import type { User } from "@supabase/supabase-js";
import type { ImportedWipRecord, RepairOrder } from "../models/RepairOrder";
import type { OperationalRecommendation } from "./recommendationEngine";
import { supabase } from "../lib/supabase";

export type ActionStatus = "open" | "in_progress" | "completed" | "dismissed" | "missed";

export type ActionItem = {
  id: string;
  shop_id: string;
  source_key: string | null;
  title: string;
  description: string;
  action_type: string;
  priority: "critical" | "high" | "medium" | "low";
  assigned_to: string | null;
  source: string;
  due_at: string | null;
  status: ActionStatus;
  completed_at: string | null;
  dismissal_reason: string | null;
  metadata: Record<string, unknown>;
};

type TenantContext = { organizationId: string; shopId: string; user: User };

async function tenantContext(shopName: string): Promise<TenantContext> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentication is required.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("organization_id").eq("id", auth.user.id).single<{ organization_id: string }>();
  if (profileError) throw profileError;
  const { data: shop, error: shopError } = await supabase
    .from("shops").select("id").eq("organization_id", profile.organization_id)
    .eq("name", shopName).single<{ id: string }>();
  if (shopError) throw shopError;
  return { organizationId: profile.organization_id, shopId: shop.id, user: auth.user };
}

function nullableDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function persistWipImport(record: ImportedWipRecord, orders: RepairOrder[]): Promise<void> {
  if (!supabase) return;
  const context = await tenantContext(record.selectedShop ?? orders[0]?.shop ?? "");
  const { data: imported, error: importError } = await supabase.from("wip_imports").insert({
    organization_id: context.organizationId, shop_id: context.shopId, imported_by: context.user.id,
    source: record.source, file_name: record.fileName, row_count: orders.length, status: "completed",
  }).select("id").single<{ id: string }>();
  if (importError) throw importError;

  const payload = orders.map((order) => ({
    organization_id: context.organizationId, shop_id: context.shopId, wip_import_id: imported.id,
    ro_number: order.roNumber, customer: order.customer, vehicle: order.vehicle, stage: order.stage,
    labor_hours: order.laborHours, pre_tax_total: order.preTaxTotal, estimator: order.estimator,
    insurance: order.insurance, created_date: nullableDate(order.createdDate), arrival_date: nullableDate(order.arrivalDate),
    completed_date: nullableDate(order.completedDate), vehicle_status: order.vehicleStatus,
    source: record.source, source_metadata: { fileName: record.fileName }, imported_at: record.importedAt,
  }));
  const { error } = await supabase.from("repair_orders").upsert(payload, { onConflict: "shop_id,ro_number" });
  if (error) throw error;
}

export async function syncRecommendationActions(recommendations: OperationalRecommendation[]): Promise<void> {
  if (!supabase || recommendations.length === 0) return;
  const groups = new Map<string, OperationalRecommendation[]>();
  recommendations.forEach((item) => groups.set(item.shop, [...(groups.get(item.shop) ?? []), item]));
  for (const [shopName, items] of groups) {
    const context = await tenantContext(shopName);
    const payload = items.map((item) => ({
      organization_id: context.organizationId, shop_id: context.shopId, source_key: item.id,
      title: item.title, description: item.action, action_type: item.blocker,
      priority: item.priority.toLowerCase(), source: "intelligence_core", created_by: context.user.id,
      metadata: { roNumber: item.roNumber, vehicle: item.vehicle, stage: item.stage, reason: item.reason, owner: item.owner },
    }));
    const { error } = await supabase.from("action_items").upsert(payload, {
      onConflict: "shop_id,source_key",
    });
    if (error) throw error;
  }
}

export async function loadActionItems(statuses?: ActionStatus[]): Promise<ActionItem[]> {
  if (!supabase) return [];
  let query = supabase.from("action_items").select("id, shop_id, source_key, title, description, action_type, priority, assigned_to, source, due_at, status, completed_at, dismissal_reason, metadata")
    .order("created_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query.returns<ActionItem[]>();
  if (error) throw error;
  return data ?? [];
}

export async function updateActionItem(id: string, status: ActionStatus, dismissalReason?: string): Promise<void> {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const completed = status === "completed";
  const { error } = await supabase.from("action_items").update({
    status, completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? auth.user?.id ?? null : null,
    dismissal_reason: status === "dismissed" ? dismissalReason ?? "Dismissed by user" : null,
  }).eq("id", id);
  if (error) throw error;
}
