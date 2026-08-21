import { useEffect, useMemo, useState } from "react";
import {
  advanceRepairLifecycle, createScheduledRepair, loadRepairLifecycleEvents, loadRepairWorkspace,
  updateRepairWorkspace, loadJobCostInvoices, addJobCostInvoice,
  setRepairDisposition, type RepairDisposition,
  type JobCostCategory, type JobCostInvoice, type RepairLifecycleEvent, type RepairLifecycleStatus,
  type RepairWorkspaceRecord, type RepairWorkspaceShop,
} from "./services/repairWorkspaceData";

const lifecycle: RepairLifecycleStatus[] = ["scheduled", "arrived", "wip", "qc", "delivered"];
const emptyForm = { shopId: "", roNumber: "", customer: "", vehicle: "", scheduledDate: "", insurance: "", vin: "", claimNumber: "" };
const emptyInvoice = { category: "parts" as JobCostCategory, vendor: "", invoiceNumber: "", invoiceDate: "", amount: "", notes: "" };

function payloadNumber(repair: RepairWorkspaceRecord, key: string) {
  const value = repair.source_payload?.[key];
  return typeof value === "number" ? value : Number(value || 0);
}
function payloadText(repair: RepairWorkspaceRecord, key: string) {
  const value = repair.source_payload?.[key];
  return typeof value === "string" ? value : "";
}
function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type RepairWorkspaceProps = { initialRepairId?: string | null; focused?: boolean };

function RepairWorkspace({ initialRepairId, focused = false }: RepairWorkspaceProps) {
  const [repairs, setRepairs] = useState<RepairWorkspaceRecord[]>([]);
  const [shops, setShops] = useState<RepairWorkspaceShop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<RepairLifecycleEvent[]>([]);
  const [invoices, setInvoices] = useState<JobCostInvoice[]>([]);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [shopFilter, setShopFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workFileExited, setWorkFileExited] = useState(false);

  async function refresh(preferredId?: string) {
    const data = await loadRepairWorkspace();
    setRepairs(data.repairs); setShops(data.shops);
    setSelectedId((current) => preferredId ?? current ?? data.repairs[0]?.id ?? null);
    setError("");
  }

  useEffect(() => {
    let active = true;
    void loadRepairWorkspace().then((data) => {
      if (!active) return;
      setRepairs(data.repairs); setShops(data.shops);
      setSelectedId(data.repairs.some((repair) => repair.id === initialRepairId) ? initialRepairId! : data.repairs[0]?.id ?? null);
      setForm((current) => ({ ...current, shopId: data.shops[0]?.id ?? "" }));
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Repair workspace could not be loaded."); });
    return () => { active = false; };
  }, [initialRepairId]);

  function openWorkFile(repair: RepairWorkspaceRecord) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("page", "repairs");
    url.searchParams.set("ro", repair.id);
    window.open(url.toString(), `_blank`, "noopener,noreferrer");
  }

  function leaveCompletedWorkFile() {
    setSelectedId(null);
    if (!initialRepairId) return;

    window.close();
    window.setTimeout(() => setWorkFileExited(true), 150);
  }

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void loadRepairLifecycleEvents(selectedId).then((data) => { if (active) setEvents(data); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Repair history could not be loaded."); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void loadJobCostInvoices(selectedId).then((data) => { if (active) setInvoices(data); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Job costs could not be loaded."); });
    return () => { active = false; };
  }, [selectedId]);

  const filtered = useMemo(() => repairs.filter((repair) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [repair.ro_number, repair.customer, repair.vehicle, repair.vin, repair.claim_number]
      .some((value) => value?.toLowerCase().includes(query));
    const disposition = payloadText(repair, "fileDisposition");
    const matchesStatus = statusFilter === "all" || (statusFilter === "active"
      ? repair.lifecycle_status !== "delivered" && !disposition
      : statusFilter === "closed" || statusFilter === "cancelled"
        ? disposition === statusFilter
        : repair.lifecycle_status === statusFilter && !disposition);
    return matchesSearch && matchesStatus && (shopFilter === "all" || repair.shop_id === shopFilter);
  }), [repairs, search, shopFilter, statusFilter]);

  const selected = repairs.find((repair) => repair.id === selectedId) ?? null;
  const selectedDisposition = selected ? payloadText(selected, "fileDisposition") : "";
  const statusIndex = selected ? lifecycle.indexOf(selected.lifecycle_status) : -1;
  const nextStatus = statusIndex >= 0 && statusIndex < lifecycle.length - 1 ? lifecycle[statusIndex + 1] : null;
  const shopName = (id: string) => shops.find((shop) => shop.id === id)?.name ?? "Unknown shop";

  async function advance() {
    if (!selected || !nextStatus) return;
    setBusy(true);
    try { await advanceRepairLifecycle(selected.id, nextStatus); await refresh(selected.id); setEvents(await loadRepairLifecycleEvents(selected.id)); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Repair could not advance."); }
    finally { setBusy(false); }
  }

  async function saveField(changes: Parameters<typeof updateRepairWorkspace>[1]) {
    if (!selected) return;
    try { await updateRepairWorkspace(selected.id, changes); await refresh(selected.id); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Repair details could not be saved."); }
  }

  async function createRepair() {
    if (!form.shopId || !form.roNumber.trim()) { setError("Shop and repair-order number are required."); return; }
    setBusy(true);
    try { const id = await createScheduledRepair(form); await refresh(id); setForm({ ...emptyForm, shopId: form.shopId }); setShowCreate(false); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Scheduled repair could not be created."); }
    finally { setBusy(false); }
  }

  async function createInvoice() {
    if (!selected) return;
    const amount = Number(invoiceForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter an invoice total greater than zero."); return; }
    setBusy(true);
    try {
      await addJobCostInvoice(selected.id, { ...invoiceForm, amount });
      setInvoices(await loadJobCostInvoices(selected.id)); setInvoiceForm(emptyInvoice); setError("");
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Invoice could not be added."); }
    finally { setBusy(false); }
  }

  async function dispositionJob(disposition: RepairDisposition) {
    if (!selected) return;
    const action = disposition === "closed" ? "close" : "cancel";
    if (!window.confirm(`${action === "close" ? "Close" : "Cancel"} RO ${selected.ro_number}? The work file and invoices will be retained.`)) return;
    setBusy(true);
    try {
      await setRepairDisposition(selected.id, disposition);
      await refresh();
      leaveCompletedWorkFile();
    }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : `The job could not be ${action}d.`); }
    finally { setBusy(false); }
  }

  if (focused && workFileExited) return <section className="panel workfile-exit-screen"><p className="eyebrow">WORK FILE CLOSED</p><h2>This work-file window is finished.</h2><p>You can safely close this browser tab. No repair or sales status was changed by closing the window.</p><button className="secondary-button" onClick={() => window.close()} type="button">Close browser tab</button></section>;

  return <>
    {focused ? <header className="workfile-window-header"><div><p className="eyebrow">CRASH OPS PRO</p><h2>Repair order work file</h2></div><button className="secondary-button" onClick={leaveCompletedWorkFile} type="button">Close work-file window</button></header> : <header className="topbar"><div><p className="eyebrow">CORE REPAIR RECORD</p><h2>Repairs</h2><p className="page-description">One record from estimate intake through delivery. Filter, open, and advance the repair without re-entering the job.</p></div><button className="primary-button" onClick={() => setShowCreate((value) => !value)} type="button">{showCreate ? "Cancel" : "Add scheduled repair"}</button></header>}
    {error && <section className="panel import-error"><strong>Repair workspace needs attention</strong><p>{error}</p></section>}
    {!focused && showCreate && <section className="panel repair-create"><label>Location<select value={form.shopId} onChange={(event) => setForm({ ...form, shopId: event.target.value })}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label><label>RO / workfile number<input value={form.roNumber} onChange={(event) => setForm({ ...form, roNumber: event.target.value })}/></label><label>Drop date<input type="date" value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })}/></label><label>Customer<input value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })}/></label><label>Vehicle<input value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })}/></label><label>VIN<input value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })}/></label><label>Claim<input value={form.claimNumber} onChange={(event) => setForm({ ...form, claimNumber: event.target.value })}/></label><label>Insurer<input value={form.insurance} onChange={(event) => setForm({ ...form, insurance: event.target.value })}/></label><button className="primary-button" disabled={busy} onClick={() => void createRepair()} type="button">Create repair</button></section>}

    {!focused && <><section className="repair-lifecycle-metrics">{lifecycle.map((status) => <article className="card" key={status}><p>{status}</p><strong>{repairs.filter((repair) => repair.lifecycle_status === status && !payloadText(repair, "fileDisposition")).length}</strong><small>{status === "wip" ? "Active production" : "Lifecycle records"}</small></article>)}</section>
    <section className="panel repair-filters"><input aria-label="Search repairs" placeholder="Search RO, customer, vehicle, VIN, or claim" value={search} onChange={(event) => setSearch(event.target.value)}/><select aria-label="Filter by shop" value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}><option value="all">All accessible shops</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select><select aria-label="Filter by lifecycle" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active repairs</option><option value="closed">Closed jobs</option><option value="cancelled">Cancelled jobs</option><option value="all">All work files</option>{lifecycle.map((status) => <option key={status} value={status}>{status}</option>)}</select></section></>}

    <div className={focused ? "repair-workspace-layout focused" : "repair-workspace-layout"}>
      {!focused && <section className="repair-card-list">{filtered.length === 0 ? <div className="panel"><p>No repairs match these filters.</p></div> : filtered.map((repair) => {
        const photo = payloadText(repair, "vehiclePhotoDataUrl");
        const bodyHours = payloadNumber(repair, "bodyLaborHours");
        const paintHours = payloadNumber(repair, "paintLaborHours");
        const parts = payloadNumber(repair, "partsTotal");
        return <article className={selectedId === repair.id ? "repair-rich-card active" : "repair-rich-card"} key={repair.id}>
          {photo && <img src={photo} alt="Vehicle" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />}
          <div><span className={`repair-lifecycle-badge ${payloadText(repair, "fileDisposition") || repair.lifecycle_status}`}>{payloadText(repair, "fileDisposition") || repair.lifecycle_status}</span><strong>RO {repair.ro_number}</strong><small>{shopName(repair.shop_id)}</small></div>
          <h3>{repair.vehicle ?? "Vehicle not recorded"}</h3>
          <p>{repair.customer ?? "Customer not recorded"} · {repair.insurance ?? "Insurer not recorded"}</p>
          <div className="repair-card-facts"><span>{repair.labor_hours.toFixed(1)} total hrs</span><span>{money(repair.pre_tax_total)}</span><span>{bodyHours.toFixed(1)} body / {paintHours.toFixed(1)} paint</span><span>{parts ? `${money(parts)} parts` : repair.estimator ?? "No estimator"}</span></div>
          {repair.scheduled_date && <small>Drop: {repair.scheduled_date}</small>}
          <button className="secondary-button repair-open-button" onClick={() => openWorkFile(repair)} type="button">Open work file in new tab</button>
        </article>;
      })}</section>}

      <section className="panel repair-workspace-detail">{!selected ? <p>Select a repair to open its workspace.</p> : <>
        <div className="panel-header"><div><p className="section-label">REPAIR WORKSPACE</p><h3>RO {selected.ro_number} · {selected.vehicle}</h3><p>{selected.customer} · {shopName(selected.shop_id)}</p></div><div className="repair-terminal-actions">{selectedDisposition ? <><span className="repair-delivered">{selectedDisposition}</span><button className="secondary-button" onClick={leaveCompletedWorkFile} type="button">Close work file</button></> : <>{nextStatus && <button className="primary-button" disabled={busy} onClick={() => void advance()} type="button">Advance to {nextStatus}</button>}<button className="secondary-button" disabled={busy} onClick={() => void dispositionJob("closed")} type="button">Close job</button><button className="danger-button" disabled={busy} onClick={() => void dispositionJob("cancelled")} type="button">Cancel job</button></>}</div></div>
        {payloadText(selected, "vehiclePhotoDataUrl") && <img src={payloadText(selected, "vehiclePhotoDataUrl")} alt="Vehicle" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />}
        <div className="repair-lifecycle-rail">{lifecycle.map((status, index) => <div className={index <= statusIndex ? "complete" : ""} key={status}><span>{index + 1}</span><strong>{status}</strong></div>)}</div>
        <div className="repair-data-grid">
          <div><span>Production</span><p>Stage: {selected.stage || ""}</p><p>Estimator: {selected.estimator || ""}</p><p>Technician: {selected.technician || payloadText(selected, "technician")}</p><p>Total labor: {selected.labor_hours.toFixed(1)} hours</p><p>Body / Paint: {payloadNumber(selected, "bodyLaborHours").toFixed(1)} / {payloadNumber(selected, "paintLaborHours").toFixed(1)} hrs</p></div>
          <div><span>Financial</span><p>Estimate: {selected.pre_tax_total.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p><p>Parts: {money(payloadNumber(selected, "partsTotal"))}</p><p>Paint materials: {money(payloadNumber(selected, "paintMaterialsTotal"))}</p><p>Insurer: {selected.insurance ?? "Not recorded"}</p><p>Claim: {selected.claim_number ?? "Not recorded"}</p></div>
          <div><span>Lifecycle</span><p>Scheduled: {selected.scheduled_date ?? "Not recorded"}</p><p>Arrived: {selected.arrival_date ?? "Not recorded"}</p><p>QC: {selected.qc_at ? new Date(selected.qc_at).toLocaleString() : "Not reached"}</p><p>Delivered: {selected.delivered_at ? new Date(selected.delivered_at).toLocaleString() : "Not reached"}</p><p>Workfile: {selected.workfile_id ?? "Not recorded"}</p></div>
        </div>
        {(() => {
          const sales = {
            parts: payloadNumber(selected, "partsTotal"),
            labor: payloadNumber(selected, "bodyLaborTotal") + payloadNumber(selected, "paintLaborTotal"),
            paint_materials: payloadNumber(selected, "paintMaterialsTotal"),
            total: selected.pre_tax_total,
          };
          const costs = invoices.reduce((totals, invoice) => ({ ...totals, [invoice.category]: (totals[invoice.category] ?? 0) + invoice.amount }), {} as Record<JobCostCategory, number>);
          const totalCost = Object.values(costs).reduce((sum, value) => sum + value, 0);
          const grossProfit = sales.total - totalCost;
          return <section className="workfile-costing">
            <div className="panel-header"><div><p className="section-label">WHOLE-INVOICE JOB COSTING</p><h3>Work file totals</h3></div></div>
            <div className="workfile-total-cards">
              <article><span>Total sales</span><strong>{money(sales.total)}</strong></article>
              <article><span>Invoices entered</span><strong>{money(totalCost)}</strong></article>
              <article><span>Gross profit</span><strong>{money(grossProfit)}</strong><small>{sales.total > 0 ? `${((grossProfit / sales.total) * 100).toFixed(1)}% GP` : "—"}</small></article>
              <article><span>Parts GP</span><strong>{money(sales.parts - (costs.parts ?? 0))}</strong><small>{sales.parts > 0 ? `${(((sales.parts - (costs.parts ?? 0)) / sales.parts) * 100).toFixed(1)}% GP` : "No parts sales"}</small></article>
            </div>
            <div className="workfile-category-table">
              <div><strong>Category</strong><strong>Sales</strong><strong>Cost</strong><strong>GP</strong></div>
              <div><span>Parts</span><span>{money(sales.parts)}</span><span>{money(costs.parts ?? 0)}</span><span>{money(sales.parts - (costs.parts ?? 0))}</span></div>
              <div><span>Paint materials</span><span>{money(sales.paint_materials)}</span><span>{money(costs.paint_materials ?? 0)}</span><span>{money(sales.paint_materials - (costs.paint_materials ?? 0))}</span></div>
              <div><span>Sublet</span><span>—</span><span>{money(costs.sublet ?? 0)}</span><span>—</span></div>
              <div><span>Other</span><span>—</span><span>{money(costs.other ?? 0)}</span><span>—</span></div>
            </div>
            <div className="invoice-entry">
              <p className="section-label">ADD WHOLE INVOICE</p>
              <div className="invoice-entry-grid">
                <label>Cost category<select value={invoiceForm.category} onChange={(event) => setInvoiceForm({ ...invoiceForm, category: event.target.value as JobCostCategory })}><option value="parts">Parts</option><option value="paint_materials">Paint materials</option><option value="sublet">Sublet</option><option value="other">Other</option></select></label>
                <label>Vendor<input value={invoiceForm.vendor} onChange={(event) => setInvoiceForm({ ...invoiceForm, vendor: event.target.value })}/></label>
                <label>Invoice number<input value={invoiceForm.invoiceNumber} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceNumber: event.target.value })}/></label>
                <label>Invoice date<input type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })}/></label>
                <label>Invoice total<input inputMode="decimal" placeholder="0.00" value={invoiceForm.amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })}/></label>
                <label>Note<input value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })}/></label>
              </div>
              <button className="primary-button" disabled={busy} onClick={() => void createInvoice()} type="button">Add invoice to work file</button>
            </div>
            <div className="invoice-list"><p className="section-label">INVOICES</p>{invoices.length === 0 ? <p>No job-cost invoices entered.</p> : invoices.map((invoice) => <article key={invoice.id}><div><strong>{invoice.vendor || "Vendor not entered"}</strong><span>{invoice.category.replace("_", " ")} · {invoice.invoice_number || "No invoice #"}</span></div><strong>{money(invoice.amount)}</strong></article>)}</div>
          </section>;
        })()}
        <div className="repair-edit-grid"><label>VIN<input defaultValue={selected.vin ?? ""} key={`${selected.id}-vin`} onBlur={(event) => void saveField({ vin: event.target.value || null })}/></label><label>Claim number<input defaultValue={selected.claim_number ?? ""} key={`${selected.id}-claim`} onBlur={(event) => void saveField({ claim_number: event.target.value || null })}/></label><label>Workfile ID<input defaultValue={selected.workfile_id ?? ""} key={`${selected.id}-workfile`} onBlur={(event) => void saveField({ workfile_id: event.target.value || null })}/></label><label>Scheduled date<input defaultValue={selected.scheduled_date ?? ""} key={`${selected.id}-scheduled`} type="date" onBlur={(event) => void saveField({ scheduled_date: event.target.value || null })}/></label></div>
        <label className="repair-notes">Repair notes<textarea defaultValue={selected.lifecycle_notes ?? ""} key={`${selected.id}-notes`} onBlur={(event) => void saveField({ lifecycle_notes: event.target.value || null })}/></label>
        <div className="repair-history"><p className="section-label">AUDIT TRAIL</p>{events.length === 0 ? <p>No lifecycle events recorded yet.</p> : events.map((event) => <article key={event.id}><div><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString()}</span></div>{event.old_value !== null || event.new_value !== null ? <p>{event.old_value ?? "—"} → {event.new_value ?? "—"}</p> : null}</article>)}</div>
      </>}</section>
    </div>
  </>;
}

export default RepairWorkspace;
