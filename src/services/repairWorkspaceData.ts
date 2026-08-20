import { supabase } from "../lib/supabase";

export type RepairLifecycleStatus = "scheduled" | "arrived" | "wip" | "qc" | "delivered";
export type RepairWorkspaceRecord = {
  id: string; organization_id: string; shop_id: string; ro_number: string;
  customer: string | null; vehicle: string | null; vin: string | null; claim_number: string | null;
  workfile_id: string | null; insurance: string | null; estimator: string | null; technician: string | null;
  stage: string | null; vehicle_status: string | null; labor_hours: number; pre_tax_total: number;
  lifecycle_status: RepairLifecycleStatus; scheduled_date: string | null; arrival_date: string | null;
  qc_at: string | null; delivered_at: string | null; completed_date: string | null;
  lifecycle_notes: string | null; created_at: string; updated_at: string;
};
export type RepairWorkspaceShop = { id: string; name: string };
export type RepairLifecycleEvent = {
  id: string; event_type: string; old_value: string | null; new_value: string | null;
  metadata: Record<string, unknown>; created_at: string;
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadRepairWorkspace(): Promise<{
  repairs: RepairWorkspaceRecord[]; shops: RepairWorkspaceShop[];
}> {
  const [repairs, shops] = await Promise.all([
    client().from("repair_orders").select("id, organization_id, shop_id, ro_number, customer, vehicle, vin, claim_number, workfile_id, insurance, estimator, technician, stage, vehicle_status, labor_hours, pre_tax_total, lifecycle_status, scheduled_date, arrival_date, qc_at, delivered_at, completed_date, lifecycle_notes, created_at, updated_at").order("updated_at", { ascending: false }).returns<RepairWorkspaceRecord[]>(),
    client().from("shops").select("id, name").order("name").returns<RepairWorkspaceShop[]>(),
  ]);
  const error = repairs.error ?? shops.error;
  if (error) throw error;
  return { repairs: repairs.data ?? [], shops: shops.data ?? [] };
}

export async function loadRepairLifecycleEvents(repairOrderId: string): Promise<RepairLifecycleEvent[]> {
  const { data, error } = await client().from("repair_order_events")
    .select("id, event_type, old_value, new_value, metadata, created_at")
    .eq("repair_order_id", repairOrderId).order("created_at", { ascending: false })
    .returns<RepairLifecycleEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function advanceRepairLifecycle(
  repairOrderId: string, status: RepairLifecycleStatus,
): Promise<void> {
  const { error } = await client().rpc("advance_repair_lifecycle", {
    requested_repair_order_id: repairOrderId, requested_status: status,
  });
  if (error) throw error;
}

export async function updateRepairWorkspace(
  repairOrderId: string,
  changes: Partial<Pick<RepairWorkspaceRecord, "vin" | "claim_number" | "workfile_id" | "scheduled_date" | "lifecycle_notes">>,
): Promise<void> {
  const { error } = await client().from("repair_orders").update(changes).eq("id", repairOrderId);
  if (error) throw error;
}

export async function createScheduledRepair(input: {
  shopId: string; roNumber: string; customer: string; vehicle: string;
  scheduledDate: string; insurance: string; vin: string; claimNumber: string;
}): Promise<string> {
  const current = client();
  const { data: auth } = await current.auth.getUser();
  if (!auth.user) throw new Error("Authentication is required.");
  const { data: profile, error: profileError } = await current.from("profiles")
    .select("organization_id").eq("id", auth.user.id).single<{ organization_id: string }>();
  if (profileError) throw profileError;
  const { data, error } = await current.from("repair_orders").insert({
    organization_id: profile.organization_id, shop_id: input.shopId,
    ro_number: input.roNumber.trim(), customer: input.customer.trim() || null,
    vehicle: input.vehicle.trim() || null, scheduled_date: input.scheduledDate || null,
    insurance: input.insurance.trim() || null, vin: input.vin.trim() || null,
    claim_number: input.claimNumber.trim() || null, lifecycle_status: "scheduled",
    stage: "SCHEDULED", source: "manual_repair_workspace",
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}
