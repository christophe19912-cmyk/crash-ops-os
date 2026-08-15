import { supabase } from "../lib/supabase";

export type SlaPriority = "critical" | "high" | "medium" | "low";
export type SlaRule = { id: string; organization_id: string; priority: SlaPriority; due_hours: number; escalation_hours: number; enabled: boolean };
export type DailyBrief = { id: string; shop_id: string; brief_date: string; open_count: number; in_progress_count: number; completed_count: number; missed_count: number; critical_count: number; generated_at: string };
export type ActionNotification = { id: string; action_item_id: string; title: string; message: string; read_at: string | null; created_at: string };
export type CadenceResult = { due_dates_assigned: number; actions_marked_missed: number; briefs_generated: number };

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadAutomationData(): Promise<{ rules: SlaRule[]; briefs: DailyBrief[]; notifications: ActionNotification[] }> {
  const [rules, briefs, notifications] = await Promise.all([
    client().from("action_sla_rules").select("id, organization_id, priority, due_hours, escalation_hours, enabled").order("due_hours").returns<SlaRule[]>(),
    client().from("daily_leadership_briefs").select("id, shop_id, brief_date, open_count, in_progress_count, completed_count, missed_count, critical_count, generated_at").order("brief_date", { ascending: false }).limit(30).returns<DailyBrief[]>(),
    client().from("action_notifications").select("id, action_item_id, title, message, read_at, created_at").order("created_at", { ascending: false }).limit(50).returns<ActionNotification[]>(),
  ]);
  const error = rules.error ?? briefs.error ?? notifications.error;
  if (error) throw error;
  return { rules: rules.data ?? [], briefs: briefs.data ?? [], notifications: notifications.data ?? [] };
}

export async function seedDefaultRules(): Promise<void> {
  const current = client();
  const { data: auth } = await current.auth.getUser();
  if (!auth.user) throw new Error("Authentication is required.");
  const { data: profile, error: profileError } = await current.from("profiles").select("organization_id").eq("id", auth.user.id).single<{ organization_id: string }>();
  if (profileError) throw profileError;
  const defaults: Array<[SlaPriority, number, number]> = [["critical", 4, 1], ["high", 12, 2], ["medium", 24, 4], ["low", 72, 12]];
  const { error } = await current.from("action_sla_rules").upsert(defaults.map(([priority, due, escalation]) => ({
    organization_id: profile.organization_id, priority, due_hours: due, escalation_hours: escalation,
    enabled: true, updated_by: auth.user.id,
  })), { onConflict: "organization_id,priority" });
  if (error) throw error;
}

export async function saveRule(rule: SlaRule): Promise<void> {
  const { error } = await client().from("action_sla_rules").update({
    due_hours: rule.due_hours, escalation_hours: rule.escalation_hours, enabled: rule.enabled,
    updated_at: new Date().toISOString(),
  }).eq("id", rule.id);
  if (error) throw error;
}

export async function runCadence(): Promise<CadenceResult> {
  const { data, error } = await client().rpc("run_daily_action_cadence", { requested_shop_id: null });
  if (error) throw error;
  return data as CadenceResult;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await client().from("action_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
