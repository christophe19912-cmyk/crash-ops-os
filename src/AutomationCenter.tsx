import { useEffect, useState } from "react";
import { loadAutomationData, markNotificationRead, runCadence, saveRule, seedDefaultRules, type ActionNotification, type CadenceResult, type DailyBrief, type SlaRule } from "./services/automationData";
import { useRole } from "./auth/ApplicationContext";

function AutomationCenter() {
  const role = useRole();
  const canManageRules = role === "platform_admin" || role === "organization_admin";
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [notifications, setNotifications] = useState<ActionNotification[]>([]);
  const [result, setResult] = useState<CadenceResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await loadAutomationData();
    setRules(data.rules); setBriefs(data.briefs); setNotifications(data.notifications); setError("");
  }

  useEffect(() => {
    let active = true;
    void loadAutomationData().then((data) => {
      if (!active) return;
      setRules(data.rules); setBriefs(data.briefs); setNotifications(data.notifications);
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Automation data could not be loaded."); });
    return () => { active = false; };
  }, []);

  async function initializeRules() {
    setBusy(true);
    try { await seedDefaultRules(); await refresh(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Rules could not be initialized."); }
    finally { setBusy(false); }
  }

  async function executeCadence() {
    setBusy(true);
    try { setResult(await runCadence()); await refresh(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The cadence run failed."); }
    finally { setBusy(false); }
  }

  async function persistRule(rule: SlaRule) {
    try { await saveRule(rule); await refresh(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "The SLA rule could not be saved."); }
  }

  return <>
    <header className="topbar"><div><p className="eyebrow">OPERATING CADENCE</p><h2>Action Automation</h2><p className="page-description">Apply leadership SLAs, escalate missed work, publish daily briefs, and notify accountable owners.</p></div><button className="primary-button" disabled={busy || rules.length === 0} onClick={() => void executeCadence()} type="button">{busy ? "Running…" : "Run daily cadence"}</button></header>
    {error && <section className="panel import-error"><strong>Automation unavailable</strong><p>{error}</p></section>}
    {result && <section className="automation-results"><article className="card"><p>Due dates assigned</p><strong>{result.due_dates_assigned}</strong></article><article className="card"><p>Marked missed</p><strong>{result.actions_marked_missed}</strong></article><article className="card"><p>Briefs generated</p><strong>{result.briefs_generated}</strong></article></section>}
    <section className="panel"><div className="panel-header"><div><p className="section-label">PRIORITY SLA RULES</p><h3>Response expectations</h3></div>{rules.length === 0 && canManageRules && <button className="secondary-button" disabled={busy} onClick={() => void initializeRules()} type="button">Create recommended defaults</button>}</div>{rules.length === 0 && !canManageRules && <p>An organization administrator must initialize the SLA rules.</p>}<div className="automation-rules">{rules.map((rule) => <div key={rule.id}><strong>{rule.priority}</strong><label>Due in hours<input disabled={!canManageRules} min="1" type="number" value={rule.due_hours} onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, due_hours: Number(event.target.value) } : item))}/></label><label>Escalate after<input disabled={!canManageRules} min="0" type="number" value={rule.escalation_hours} onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, escalation_hours: Number(event.target.value) } : item))}/></label><label className="automation-toggle"><input checked={rule.enabled} disabled={!canManageRules} type="checkbox" onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item))}/> Enabled</label>{canManageRules && <button className="secondary-button" onClick={() => void persistRule(rule)} type="button">Save</button>}</div>)}</div></section>
    <div className="automation-grid"><section className="panel"><div className="panel-header"><div><p className="section-label">DAILY BRIEFS</p><h3>Latest shop snapshots</h3></div></div><div className="brief-list">{briefs.length === 0 ? <p>Run the cadence to create the first daily brief.</p> : briefs.map((brief) => <article key={brief.id}><div><strong>{brief.brief_date}</strong><span>{new Date(brief.generated_at).toLocaleTimeString()}</span></div><p>{brief.open_count} open · {brief.in_progress_count} active · {brief.completed_count} completed · {brief.missed_count} missed · {brief.critical_count} critical</p></article>)}</div></section><section className="panel"><div className="panel-header"><div><p className="section-label">NOTIFICATIONS</p><h3>Escalations requiring review</h3></div></div><div className="notification-list">{notifications.length === 0 ? <p>No escalations have been generated.</p> : notifications.map((item) => <article className={item.read_at ? "read" : ""} key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.created_at).toLocaleString()}</span><p>{item.message}</p></div>{!item.read_at && <button className="secondary-button" onClick={() => void markNotificationRead(item.id).then(refresh)} type="button">Mark read</button>}</article>)}</div></section></div>
  </>;
}

export default AutomationCenter;
