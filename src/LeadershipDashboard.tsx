import { useEffect, useMemo, useState } from "react";
import {
  addActionNote, addRepairNote, downloadLeadershipCsv, loadActionTimeline, loadLeadershipData,
  loadRepairTimeline, updateActionAccountability, type LeadershipAction, type RepairOrderRecord,
  type ShopOption, type TimelineEvent, type UserOption,
  type ActionEventSummary,
} from "./services/leadershipData";

const ALL = "all";

function LeadershipDashboard() {
  const [actions, setActions] = useState<LeadershipAction[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [repairs, setRepairs] = useState<RepairOrderRecord[]>([]);
  const [actionEvents, setActionEvents] = useState<ActionEventSummary[]>([]);
  const [shop, setShop] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<LeadershipAction | null>(null);
  const [actionTimeline, setActionTimeline] = useState<TimelineEvent[]>([]);
  const [repairTimeline, setRepairTimeline] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await loadLeadershipData();
      setActions(data.actions); setShops(data.shops); setUsers(data.users); setRepairs(data.repairOrders); setActionEvents(data.actionEvents);
      setError("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Leadership data could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    void loadLeadershipData().then((data) => {
      if (!active) return;
      setActions(data.actions); setShops(data.shops); setUsers(data.users); setRepairs(data.repairOrders); setActionEvents(data.actionEvents);
      setError(""); setLoading(false);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : "Leadership data could not be loaded."); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => actions.filter((item) => {
    const created = item.created_at.slice(0, 10);
    return (shop === ALL || item.shop_id === shop) && (status === ALL || item.status === status)
      && (priority === ALL || item.priority === priority)
      && (assignee === ALL || (assignee === "unassigned" ? !item.assigned_to : item.assigned_to === assignee))
      && (!fromDate || created >= fromDate) && (!toDate || created <= toDate);
  }), [actions, assignee, fromDate, priority, shop, status, toDate]);

  const metrics = useMemo(() => {
    const completed = filtered.filter((item) => item.status === "completed");
    const missed = filtered.filter((item) => item.status === "missed").length;
    const active = filtered.filter((item) => item.status === "open" || item.status === "in_progress");
    const overdue = active.filter((item) => item.due_at && new Date(item.due_at) < new Date()).length;
    const responseHours = completed.flatMap((item) => item.completed_at ? [(new Date(item.completed_at).getTime() - new Date(item.created_at).getTime()) / 36e5] : []);
    return { active: active.length, overdue, missed, completionRate: filtered.length ? Math.round(completed.length / filtered.length * 100) : 0,
      response: responseHours.length ? Math.round(responseHours.reduce((sum, value) => sum + value, 0) / responseHours.length) : 0,
      reopened: actionEvents.filter((event) => event.event_type === "reopened" && filtered.some((item) => item.id === event.action_item_id)).length,
      dismissed: filtered.filter((item) => item.status === "dismissed").length };
  }, [actionEvents, filtered]);

  const blockers = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((totals, item) => {
    totals[item.action_type] = (totals[item.action_type] ?? 0) + 1; return totals;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5), [filtered]);

  async function openDetails(item: LeadershipAction) {
    setSelected(item); setNote("");
    try {
      const [actionEvents, repairEvents] = await Promise.all([
        loadActionTimeline(item.id), item.repair_order_id ? loadRepairTimeline(item.repair_order_id) : Promise.resolve([]),
      ]);
      setActionTimeline(actionEvents); setRepairTimeline(repairEvents);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Timeline could not be loaded."); }
  }

  async function update(item: LeadershipAction, changes: Parameters<typeof updateActionAccountability>[1]) {
    try { await updateActionAccountability(item.id, changes); await refresh(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Action could not be updated."); }
  }

  async function saveNote(target: "action" | "repair") {
    if (!selected || !note.trim()) return;
    try {
      if (target === "action") await addActionNote(selected, note.trim()); else await addRepairNote(selected, note.trim());
      await openDetails(selected); setNote("");
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Note could not be saved."); }
  }

  const shopName = (id: string) => shops.find((item) => item.id === id)?.name ?? "Unknown shop";
  const userName = (id: string | null) => users.find((item) => item.id === id)?.full_name ?? users.find((item) => item.id === id)?.email ?? "Unassigned";
  const linkedRepair = selected?.repair_order_id ? repairs.find((item) => item.id === selected.repair_order_id) : null;

  return <>
    <header className="topbar"><div><p className="eyebrow">LEADERSHIP EXECUTION</p><h2>Accountability Dashboard</h2><p className="page-description">Track ownership, deadlines, completion, missed actions, and repair-order history across accessible shops.</p></div><button className="primary-button" onClick={() => downloadLeadershipCsv(filtered, shops, users)} type="button">Export CSV</button></header>
    {error && <section className="panel import-error"><strong>Dashboard unavailable</strong><p>{error}</p></section>}
    <section className="leadership-metrics">
      <article className="card"><p>Open actions</p><strong>{metrics.active}</strong><small>{metrics.overdue} overdue</small></article>
      <article className="card"><p>Completion rate</p><strong>{metrics.completionRate}%</strong><small>Filtered period</small></article>
      <article className="card"><p>Average response</p><strong>{metrics.response}h</strong><small>Created to completed</small></article>
      <article className="card"><p>Missed / Dismissed</p><strong>{metrics.missed} / {metrics.dismissed}</strong><small>{metrics.reopened} reopened</small></article>
    </section>
    <section className="panel leadership-filters">
      <label>Shop<select value={shop} onChange={(event) => setShop(event.target.value)}><option value={ALL}>All accessible</option>{shops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value={ALL}>All</option>{["open", "in_progress", "completed", "dismissed", "missed"].map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></label>
      <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value={ALL}>All</option>{["critical", "high", "medium", "low"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Assignee<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value={ALL}>All</option><option value="unassigned">Unassigned</option>{users.map((item) => <option key={item.id} value={item.id}>{item.full_name ?? item.email}</option>)}</select></label>
      <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
    </section>
    <section className="panel leadership-blockers"><div><p className="section-label">REPEAT BLOCKERS</p><h3>Most frequent action types</h3></div>{blockers.length ? blockers.map(([name, count]) => <div key={name}><span>{name}</span><strong>{count}</strong></div>) : <p>No blockers match the current filters.</p>}</section>
    <section className="panel leadership-table"><div className="leadership-row leadership-head"><span>Action</span><span>Shop</span><span>Priority</span><span>Status</span><span>Assignee</span><span>Due</span><span></span></div>
      {loading ? <p>Loading leadership activity…</p> : filtered.map((item) => <div className="leadership-row" key={item.id}><div><strong>{item.title}</strong><small>{item.action_type}</small></div><span>{shopName(item.shop_id)}</span><span className={`priority-badge ${item.priority}`}>{item.priority}</span><span>{item.status.replace("_", " ")}</span><select aria-label={`Assign ${item.title}`} value={item.assigned_to ?? ""} onChange={(event) => void update(item, { assigned_to: event.target.value || null })}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select><input aria-label={`Due date for ${item.title}`} type="datetime-local" value={item.due_at?.slice(0, 16) ?? ""} onChange={(event) => void update(item, { due_at: event.target.value ? new Date(event.target.value).toISOString() : null })}/><button className="secondary-button" onClick={() => void openDetails(item)} type="button">Timeline</button></div>)}
    </section>
    {selected && <div className="leadership-overlay" role="presentation" onClick={() => setSelected(null)}><section className="leadership-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="secondary-button" onClick={() => setSelected(null)} type="button">Close</button><p className="eyebrow">ACTION & REPAIR HISTORY</p><h2>{selected.title}</h2><p>{shopName(selected.shop_id)} · {userName(selected.assigned_to)}</p>{linkedRepair && <div className="repair-summary"><strong>RO {linkedRepair.ro_number}</strong><span>{linkedRepair.customer} · {linkedRepair.vehicle}</span><span>{linkedRepair.stage} · Estimator {linkedRepair.estimator}</span></div>}<div className="timeline-columns"><div><h3>Action timeline</h3><Timeline events={actionTimeline}/></div><div><h3>Repair-order timeline</h3><Timeline events={repairTimeline}/></div></div><textarea placeholder="Add a leadership note…" value={note} onChange={(event) => setNote(event.target.value)}/><div className="header-actions"><button className="primary-button" onClick={() => void saveNote("action")} type="button">Add action note</button>{selected.repair_order_id && <button className="secondary-button" onClick={() => void saveNote("repair")} type="button">Add repair note</button>}</div></section></div>}
  </>;
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p>No history recorded yet.</p>;
  return <div className="timeline-list">{events.map((event) => <article key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.old_value !== null || event.new_value !== null ? <p>{event.old_value ?? "—"} → {event.new_value ?? "—"}</p> : null}{typeof event.metadata.note === "string" && <p>{event.metadata.note}</p>}</article>)}</div>;
}

export default LeadershipDashboard;
