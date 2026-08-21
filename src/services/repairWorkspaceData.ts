import { supabase } from "../lib/supabase";

export type RepairLifecycleStatus = "scheduled" | "arrived" | "wip" | "qc" | "delivered";
export type RepairWorkspaceRecord = {
  id: string; organization_id: string; shop_id: string; ro_number: string;
  customer: string | null; vehicle: string | null; vin: string | null; claim_number: string | null;
  workfile_id: string | null; insurance: string | null; estimator: string | null; technician: string | null;
  stage: string | null; vehicle_status: string | null; labor_hours: number; pre_tax_total: number;
  lifecycle_status: RepairLifecycleStatus; scheduled_date: string | null; arrival_date: string | null;
  qc_at: string | null; delivered_at: string | null; completed_date: string | null;
  lifecycle_notes: string | null; source_payload: Record<string, unknown>;
  created_at: string; updated_at: string;
};
export type RepairWorkspaceShop = { id: string; name: string };
export type RepairLifecycleEvent = {
  id: string; event_type: string; old_value: string | null; new_value: string | null;
  metadata: Record<string, unknown>; created_at: string;
};
export type JobCostCategory = "parts" | "sublet" | "paint_materials" | "other";
export type JobCostInvoice = {
  id: string; repair_order_id: string; category: JobCostCategory; vendor: string | null;
  invoice_number: string | null; invoice_date: string | null; amount: number;
  notes: string | null; source: "manual" | "ai_scan"; created_at: string;
};

export type EstimateRepairInput = {
  shopName: string;
  scheduledDate?: string;
  customer: string;
  vehicle: string;
  vin: string;
  cccJobNumber: string;
  claimNumber: string;
  workfileId: string;
  insuranceCompany: string;
  estimator: string;
  totalLaborHours: number;
  totalCostOfRepairs: number;
  notes?: string;
  vehiclePhotoDataUrl?: string;
  estimateFileNames?: string[];
  bodyLaborHours?: number;
  paintLaborHours?: number;
  frameLaborHours?: number;
  mechanicalLaborHours?: number;
  partsTotal?: number;
  bodyLaborTotal?: number;
  paintLaborTotal?: number;
  paintMaterialsTotal?: number;
  salesTax?: number;
  deductible?: number;
  adjustments?: number;
  netCostOfRepairs?: number;
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function supabaseError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const value = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [value.message, value.details, value.hint].filter(Boolean);
    if (parts.length) return new Error(parts.join(" · "));
    if (value.code) return new Error(`${fallback} (${value.code})`);
  }
  return new Error(fallback);
}

async function currentOrganizationId(): Promise<string> {
  const current = client();
  const { data: auth } = await current.auth.getUser();
  if (!auth.user) throw new Error("Authentication is required.");
  const { data: profile, error } = await current.from("profiles")
    .select("organization_id").eq("id", auth.user.id).single<{ organization_id: string }>();
  if (error) throw supabaseError(error, "Your organization profile could not be loaded.");
  if (!profile?.organization_id) throw new Error("Your user profile is not assigned to an organization.");
  return profile.organization_id;
}

export async function loadRepairWorkspace(): Promise<{
  repairs: RepairWorkspaceRecord[]; shops: RepairWorkspaceShop[];
}> {
  type CompatibleRepairRow = Omit<RepairWorkspaceRecord, "technician" | "created_at" | "updated_at"> & { imported_at: string };
  const [repairs, shops] = await Promise.all([
    client().from("repair_orders").select("id, organization_id, shop_id, ro_number, customer, vehicle, vin, claim_number, workfile_id, insurance, estimator, stage, vehicle_status, labor_hours, pre_tax_total, lifecycle_status, scheduled_date, arrival_date, qc_at, delivered_at, completed_date, lifecycle_notes, source_payload, imported_at").order("imported_at", { ascending: false }).returns<CompatibleRepairRow[]>(),
    client().from("shops").select("id, name").order("name").returns<RepairWorkspaceShop[]>(),
  ]);
  const error = repairs.error ?? shops.error;
  if (error) throw supabaseError(error, "Repair workspace could not be loaded.");
  return {
    repairs: (repairs.data ?? []).map((repair) => ({
      ...repair, technician: null, created_at: repair.imported_at, updated_at: repair.imported_at,
    })),
    shops: shops.data ?? [],
  };
}

export async function loadRepairLifecycleEvents(repairOrderId: string): Promise<RepairLifecycleEvent[]> {
  const { data, error } = await client().from("repair_order_events")
    .select("id, event_type, old_value, new_value, metadata, created_at")
    .eq("repair_order_id", repairOrderId).order("created_at", { ascending: false })
    .returns<RepairLifecycleEvent[]>();
  if (error) throw supabaseError(error, "Repair history could not be loaded.");
  return data ?? [];
}

export async function loadJobCostInvoices(repairOrderId: string): Promise<JobCostInvoice[]> {
  const { data, error } = await client().from("repair_order_invoices")
    .select("id, repair_order_id, category, vendor, invoice_number, invoice_date, amount, notes, source, created_at")
    .eq("repair_order_id", repairOrderId).order("invoice_date", { ascending: false })
    .returns<JobCostInvoice[]>();
  if (error) throw supabaseError(error, "Job-cost invoices could not be loaded.");
  return data ?? [];
}

export async function addJobCostInvoice(repairOrderId: string, input: {
  category: JobCostCategory; vendor: string; invoiceNumber: string;
  invoiceDate: string; amount: number; notes: string;
}): Promise<void> {
  const organizationId = await currentOrganizationId();
  const { data: repair, error: repairError } = await client().from("repair_orders")
    .select("shop_id").eq("id", repairOrderId).single<{ shop_id: string }>();
  if (repairError) throw supabaseError(repairError, "The repair work file could not be verified.");
  const { error } = await client().from("repair_order_invoices").insert({
    organization_id: organizationId, shop_id: repair.shop_id, repair_order_id: repairOrderId,
    category: input.category, vendor: input.vendor.trim() || null,
    invoice_number: input.invoiceNumber.trim() || null, invoice_date: input.invoiceDate || null,
    amount: input.amount, notes: input.notes.trim() || null, source: "manual",
  });
  if (error) throw supabaseError(error, "The invoice could not be added to this work file.");
}

export async function advanceRepairLifecycle(
  repairOrderId: string, status: RepairLifecycleStatus,
): Promise<void> {
  const { error } = await client().rpc("advance_repair_lifecycle", {
    requested_repair_order_id: repairOrderId, requested_status: status,
  });
  if (error) throw supabaseError(error, "Repair could not advance.");
}

export async function updateRepairWorkspace(
  repairOrderId: string,
  changes: Partial<Pick<RepairWorkspaceRecord, "vin" | "claim_number" | "workfile_id" | "scheduled_date" | "lifecycle_notes">>,
): Promise<void> {
  const { error } = await client().from("repair_orders").update(changes).eq("id", repairOrderId);
  if (error) throw supabaseError(error, "Repair details could not be saved.");
}

export async function createScheduledRepair(input: {
  shopId: string; roNumber: string; customer: string; vehicle: string;
  scheduledDate: string; insurance: string; vin: string; claimNumber: string;
}): Promise<string> {
  const organizationId = await currentOrganizationId();
  const { data, error } = await client().from("repair_orders").insert({
    organization_id: organizationId, shop_id: input.shopId,
    ro_number: input.roNumber.trim(), customer: input.customer.trim() || null,
    vehicle: input.vehicle.trim() || null, scheduled_date: input.scheduledDate || null,
    insurance: input.insurance.trim() || null, vin: input.vin.trim() || null,
    claim_number: input.claimNumber.trim() || null, lifecycle_status: "scheduled",
    stage: "SCHEDULED", source_payload: { source: "manual_repair_workspace" },
  }).select("id").single<{ id: string }>();
  if (error) throw supabaseError(error, "Scheduled repair could not be created.");
  return data.id;
}

export async function createRepairFromEstimate(input: EstimateRepairInput): Promise<string> {
  const organizationId = await currentOrganizationId();
  const { data: shops, error: shopsError } = await client().from("shops")
    .select("id, name").eq("organization_id", organizationId).order("name")
    .returns<RepairWorkspaceShop[]>();
  if (shopsError) throw supabaseError(shopsError, "Repair locations could not be loaded.");

  const normalized = input.shopName.trim().toLowerCase();
  const shop = (shops ?? []).find((candidate) => candidate.name.trim().toLowerCase() === normalized) ?? shops?.[0];
  if (!shop) throw new Error("No accessible repair location is configured for this organization.");

  const roNumber = input.cccJobNumber.trim() || input.workfileId.trim() || `EST-${Date.now()}`;
  const sourcePayload = {
    source: "estimate_intake",
    cccJobNumber: input.cccJobNumber,
    bodyLaborHours: input.bodyLaborHours ?? 0,
    paintLaborHours: input.paintLaborHours ?? 0,
    frameLaborHours: input.frameLaborHours ?? 0,
    mechanicalLaborHours: input.mechanicalLaborHours ?? 0,
    partsTotal: input.partsTotal ?? 0,
    bodyLaborTotal: input.bodyLaborTotal ?? 0,
    paintLaborTotal: input.paintLaborTotal ?? 0,
    paintMaterialsTotal: input.paintMaterialsTotal ?? 0,
    salesTax: input.salesTax ?? 0,
    deductible: input.deductible ?? 0,
    adjustments: input.adjustments ?? 0,
    netCostOfRepairs: input.netCostOfRepairs ?? 0,
    vehiclePhotoDataUrl: input.vehiclePhotoDataUrl ?? "",
    estimateFileNames: input.estimateFileNames ?? [],
  };

  const repairValues = {
    customer: input.customer.trim() || null,
    vehicle: input.vehicle.trim() || null,
    vin: input.vin.trim() || null,
    claim_number: input.claimNumber.trim() || null,
    workfile_id: input.workfileId.trim() || null,
    insurance: input.insuranceCompany.trim() || null,
    estimator: input.estimator.trim() || null,
    labor_hours: input.totalLaborHours || 0,
    pre_tax_total: input.totalCostOfRepairs || 0,
    scheduled_date: input.scheduledDate || null,
    lifecycle_notes: input.notes?.trim() || null,
    source_payload: sourcePayload,
  };

  const { data: existing, error: existingError } = await client().from("repair_orders")
    .select("id, lifecycle_status")
    .eq("shop_id", shop.id)
    .eq("ro_number", roNumber)
    .maybeSingle<{ id: string; lifecycle_status: RepairLifecycleStatus }>();
  if (existingError) throw supabaseError(existingError, "Crash Ops could not check for an existing repair.");

  if (existing) {
    const { error: updateError } = await client().from("repair_orders")
      .update(repairValues)
      .eq("id", existing.id);
    if (updateError) throw supabaseError(updateError, "The existing repair was found, but estimate data could not be attached.");
    return existing.id;
  }

  const { data, error } = await client().from("repair_orders").insert({
    organization_id: organizationId,
    shop_id: shop.id,
    ro_number: roNumber,
    ...repairValues,
    lifecycle_status: "scheduled",
    stage: "SCHEDULED",
  }).select("id").single<{ id: string }>();

  if (error) throw supabaseError(error, `Repair ${roNumber} could not be created.`);
  return data.id;
}
