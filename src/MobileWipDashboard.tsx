import { useMemo, useRef, useState } from "react";
import "./MobileWipDashboard.css";

type WipRow = {
  ro: string; customer: string; estimator: string; vehicle: string; insurance: string;
  arrival: string; body: number; mech: number; refinish: number; total: number;
  sales: number; stage: string; technician: string; action: string;
};

type StoredWip = { fileName: string; importedAt: string; rows: WipRow[] };

const STORAGE_KEY = "crashOpsMobileWip";
const BODY_WEEKLY_CAPACITY = 345;
const REFINISH_WEEKLY_CAPACITY = 150;
const TOUCH_TARGET = 2.5;

function num(value: unknown) {
  const n = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function text(value: unknown) { return String(value ?? "").trim(); }
function daysOnSite(value: string) {
  if (!value) return 0;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function statusFor(load: number) {
  if (load >= 100) return { label: "HOLD INTAKE", cls: "red" };
  if (load >= 85) return { label: "WATCH CAPACITY", cls: "yellow" };
  return { label: "CAPTURE WORK", cls: "green" };
}
function loadStored(): StoredWip | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

export default function MobileWipDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [record, setRecord] = useState<StoredWip | null>(() => loadStored());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("ALL");
  const [view, setView] = useState<"overview" | "wip" | "techs">("overview");

  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
      const headers = (matrix[0] || []).map(text);
      const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      const at = (row: unknown[], name: string) => idx(name) >= 0 ? row[idx(name)] : "";
      let tech = "";
      const rows: WipRow[] = [];
      for (const source of matrix.slice(1)) {
        const first = text(source[0]).replace(/Â/g, "").replace(/\u00a0/g, " ");
        if (/^B Tech:/i.test(first)) {
          const m = first.match(/^B Tech:\s*(.*?)\s*(?:---|$)/i);
          tech = m?.[1]?.trim() || "Unassigned";
          continue;
        }
        const ro = text(at(source, "Folder"));
        if (!ro) continue;
        const year = text(at(source, "Year")); const make = text(at(source, "Make")); const model = text(at(source, "Model"));
        const body = num(at(source, "B Hrs")); const mech = num(at(source, "M Hrs")); const refinish = num(at(source, "R Hrs"));
        const totalLegacy = num(at(source, "Total Labor Hours"));
        rows.push({
          ro, customer: text(at(source, "Customer")), estimator: text(at(source, "Service Resource")) || text(at(source, "Sales Resource")),
          vehicle: [year, make, model].filter(Boolean).join(" ") || text(at(source, "Vehicle")), insurance: text(at(source, "Insurance")),
          arrival: text(at(source, "Arrival")) || text(at(source, "Arrival Date")), body, mech, refinish,
          total: body + mech + refinish || totalLegacy, sales: num(at(source, "Pre-Tax Total")) || num(at(source, "Pre Tax Total")),
          stage: text(at(source, "Stage")) || text(at(source, "Repair Stage")) || "UNASSIGNED", technician: tech || text(at(source, "Crash Ops Technician")) || "Unassigned",
          action: text(at(source, "Action")),
        });
      }
      if (!rows.length) throw new Error("No repair orders were found in this WIP report.");
      const next = { fileName: file.name, importedAt: new Date().toISOString(), rows };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setRecord(next); setView("overview");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read WIP report."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  const data = useMemo(() => {
    const rows = record?.rows || [];
    const totalSales = rows.reduce((s,r)=>s+r.sales,0); const totalHours = rows.reduce((s,r)=>s+r.total,0);
    const bodyHours = rows.reduce((s,r)=>s+r.body,0); const refinishHours = rows.reduce((s,r)=>s+r.refinish,0);
    const active = rows.filter(r => !["HOLD","ARRV","DTLQC"].includes(r.stage.toUpperCase()));
    const activeBody = active.reduce((s,r)=>s+r.body,0); const activeRefinish = active.reduce((s,r)=>s+r.refinish,0);
    const bodyWeeks = activeBody / BODY_WEEKLY_CAPACITY; const refinishWeeks = activeRefinish / REFINISH_WEEKLY_CAPACITY;
    const load = Math.round(Math.max(bodyWeeks/2.5, refinishWeeks/2.5)*100);
    const stages = Array.from(new Set(rows.map(r=>r.stage))).sort();
    const techs = Object.entries(rows.reduce<Record<string,{jobs:number,hours:number}>>((a,r)=>{ const k=r.technician||"Unassigned"; a[k] ||= {jobs:0,hours:0}; a[k].jobs++; a[k].hours += r.body+r.mech; return a; },{})).sort((a,b)=>b[1].hours-a[1].hours);
    return { rows,totalSales,totalHours,bodyHours,refinishHours,activeBody,activeRefinish,bodyWeeks,refinishWeeks,load,stages,techs };
  },[record]);
  const status = statusFor(data.load);
  const filtered = data.rows.filter(r => (stage === "ALL" || r.stage === stage) && (!query || `${r.ro} ${r.customer} ${r.vehicle} ${r.technician}`.toLowerCase().includes(query.toLowerCase())));

  return <div className="mwip-shell">
    <header className="mwip-head"><div><span>BODY BY COCHRAN</span><h1>WIP & Capacity</h1></div><button onClick={()=>inputRef.current?.click()}>{busy ? "Reading…" : "Upload WIP"}</button><input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])}/></header>
    {error && <div className="mwip-error">{error}</div>}
    {!record ? <main className="mwip-empty"><strong>Upload your Nexsyis WIP report</strong><p>Use the same report on your phone. The dashboard will calculate workload, capacity, technician load and WIP details.</p><button onClick={()=>inputRef.current?.click()}>Choose WIP File</button></main> : <>
      <main className="mwip-main">
        <div className={`mwip-status ${status.cls}`}><span>SHOP POSITION</span><strong>{status.label}</strong><b>{data.load}% target WIP load</b></div>
        <section className="mwip-kpis"><div><span>Vehicles</span><b>{data.rows.length}</b></div><div><span>WIP $</span><b>${Math.round(data.totalSales).toLocaleString()}</b></div><div><span>Total Hrs</span><b>{data.totalHours.toFixed(0)}</b></div><div><span>Touch Target</span><b>{TOUCH_TARGET}/day</b></div></section>
        {view === "overview" && <>
          <section className="mwip-card"><h2>Department Capacity</h2><div className="mwip-cap"><div><span>BODY</span><b>{data.activeBody.toFixed(1)} hrs</b><small>{data.bodyWeeks.toFixed(1)} weeks active WIP · {BODY_WEEKLY_CAPACITY} hrs/wk capacity</small><progress max="3.5" value={Math.min(data.bodyWeeks,3.5)}/></div><div><span>REFINISH</span><b>{data.activeRefinish.toFixed(1)} hrs</b><small>{data.refinishWeeks.toFixed(1)} weeks active WIP · {REFINISH_WEEKLY_CAPACITY} hrs/wk capacity</small><progress max="3.5" value={Math.min(data.refinishWeeks,3.5)}/></div></div></section>
          <section className="mwip-card"><h2>Stage Load</h2><div className="mwip-stagegrid">{data.stages.map(s=><button key={s} onClick={()=>{setStage(s);setView("wip")}}><b>{data.rows.filter(r=>r.stage===s).length}</b><span>{s}</span></button>)}</div></section>
          <section className="mwip-card"><h2>Technician Load</h2>{data.techs.map(([name,v])=><div className="mwip-tech" key={name}><span><b>{name}</b><small>{v.jobs} jobs</small></span><strong>{v.hours.toFixed(1)} hrs</strong></div>)}</section>
        </>}
        {view === "techs" && <section className="mwip-card"><h2>Technician WIP</h2>{data.techs.map(([name,v])=><div className="mwip-tech" key={name}><span><b>{name}</b><small>{v.jobs} vehicles assigned</small></span><strong>{v.hours.toFixed(1)} hrs</strong></div>)}</section>}
        {view === "wip" && <section><div className="mwip-filters"><input placeholder="Search RO, vehicle, tech…" value={query} onChange={e=>setQuery(e.target.value)}/><select value={stage} onChange={e=>setStage(e.target.value)}><option>ALL</option>{data.stages.map(s=><option key={s}>{s}</option>)}</select></div><div className="mwip-list">{filtered.map(r=><article key={r.ro}><div><b>RO {r.ro}</b><span className="mwip-pill">{r.stage}</span></div><h3>{r.vehicle || r.customer}</h3><p>{r.customer}</p><div className="mwip-row"><span>{r.technician}</span><strong>{r.total.toFixed(1)} hrs</strong></div><div className="mwip-row muted"><span>{daysOnSite(r.arrival)} days onsite</span><span>${Math.round(r.sales).toLocaleString()}</span></div>{r.action&&<small className="mwip-action">{r.action}</small>}</article>)}</div></section>}
        <p className="mwip-updated">{record.fileName} · Updated {new Date(record.importedAt).toLocaleString()}</p>
      </main>
      <nav className="mwip-nav"><button className={view==="overview"?"active":""} onClick={()=>setView("overview")}>Overview</button><button className={view==="wip"?"active":""} onClick={()=>{setStage("ALL");setView("wip")}}>WIP</button><button className={view==="techs"?"active":""} onClick={()=>setView("techs")}>Techs</button></nav>
    </>}
  </div>;
}
