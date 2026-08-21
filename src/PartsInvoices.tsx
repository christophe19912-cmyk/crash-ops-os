import { useEffect, useMemo, useState } from "react";
import {
  addJobCostInvoice, loadJobCostInvoices, loadRepairWorkspace, updatePartsSales,
  type JobCostInvoice, type RepairWorkspaceRecord, type RepairWorkspaceShop,
} from "./services/repairWorkspaceData";

const emptyInvoice = { vendor: "", invoiceNumber: "", invoiceDate: "", amount: "", notes: "" };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
function partsSales(repair: RepairWorkspaceRecord | null) {
  const value = repair?.source_payload?.partsTotal;
  return typeof value === "number" ? value : Number(value || 0);
}

export default function PartsInvoices() {
  const [repairs, setRepairs] = useState<RepairWorkspaceRecord[]>([]);
  const [shops, setShops] = useState<RepairWorkspaceShop[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<JobCostInvoice[]>([]);
  const [salesInput, setSalesInput] = useState("");
  const [form, setForm] = useState(emptyInvoice);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await loadRepairWorkspace(); setRepairs(data.repairs); setShops(data.shops);
    setSelectedId((current) => current || data.repairs[0]?.id || "");
  }
  useEffect(() => {
    let active = true;
    void loadRepairWorkspace().then((data) => {
      if (!active) return;
      setRepairs(data.repairs); setShops(data.shops); setSelectedId(data.repairs[0]?.id || "");
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Work files could not be loaded."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    void loadJobCostInvoices(selectedId).then(setInvoices).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Invoices could not be loaded."));
  }, [selectedId]);

  const filtered = useMemo(() => repairs.filter((repair) => {
    const query = search.trim().toLowerCase();
    return !query || [repair.ro_number, repair.customer, repair.vehicle, repair.insurance].some((value) => value?.toLowerCase().includes(query));
  }), [repairs, search]);
  const selected = repairs.find((repair) => repair.id === selectedId) ?? null;
  const shopName = (id: string) => shops.find((shop) => shop.id === id)?.name ?? "";
  const partsCost = invoices.filter((invoice) => invoice.category === "parts").reduce((sum, invoice) => sum + invoice.amount, 0);
  const sales = partsSales(selected); const gp = sales - partsCost;

  async function saveSales() {
    if (!selected) return; const value = Number(salesInput);
    if (!Number.isFinite(value) || value < 0) { setError("Enter valid parts sales."); return; }
    setBusy(true); try { await updatePartsSales(selected.id, value); await refresh(); setSalesInput(""); setError(""); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Parts sales could not be saved."); } finally { setBusy(false); }
  }
  async function addInvoice() {
    if (!selected) return; const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter an invoice total greater than zero."); return; }
    setBusy(true); try {
      await addJobCostInvoice(selected.id, { category: "parts", vendor: form.vendor, invoiceNumber: form.invoiceNumber, invoiceDate: form.invoiceDate, amount, notes: form.notes });
      setInvoices(await loadJobCostInvoices(selected.id)); setForm(emptyInvoice); setError("");
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Invoice could not be added."); } finally { setBusy(false); }
  }

  return <>
    <header className="topbar"><div><p className="eyebrow">ALL RO WORK FILES</p><h2>Parts Invoices</h2><p className="page-description">Search any imported WIP, AI Intake, or manually created RO and post whole parts invoices to its single work file.</p></div></header>
    {error && <section className="panel import-error"><strong>Parts workspace needs attention</strong><p>{error}</p></section>}
    <div className="parts-workspace-layout">
      <section className="panel parts-ro-picker"><input placeholder="Search RO, customer, vehicle, or insurer" value={search} onChange={(event) => setSearch(event.target.value)} />
        <p className="section-label">{filtered.length} WORK FILES</p>
        <div className="parts-ro-list">{filtered.map((repair) => <button className={selectedId === repair.id ? "active" : ""} key={repair.id} onClick={() => setSelectedId(repair.id)} type="button"><strong>RO {repair.ro_number}</strong><span>{repair.customer || ""}</span><small>{repair.vehicle || ""} · {shopName(repair.shop_id)}</small></button>)}</div>
      </section>
      <section className="panel parts-invoice-detail">{!selected ? <p>No work file selected.</p> : <>
        <div className="panel-header"><div><p className="section-label">RO WORK FILE</p><h3>RO {selected.ro_number}</h3><p>{selected.customer || ""} · {selected.vehicle || ""} · {shopName(selected.shop_id)}</p></div></div>
        <div className="workfile-total-cards"><article><span>Parts sales</span><strong>{money(sales)}</strong></article><article><span>Parts invoices</span><strong>{money(partsCost)}</strong></article><article><span>Parts GP</span><strong>{money(gp)}</strong><small>{sales > 0 ? `${((gp / sales) * 100).toFixed(1)}% GP` : "Enter parts sales"}</small></article></div>
        <div className="invoice-entry"><p className="section-label">PARTS SALES</p><div className="parts-sales-row"><input inputMode="decimal" placeholder={sales ? String(sales) : "Enter parts sales"} value={salesInput} onChange={(event) => setSalesInput(event.target.value)} /><button className="secondary-button" disabled={busy} onClick={() => void saveSales()} type="button">Save parts sales</button></div></div>
        <div className="invoice-entry"><p className="section-label">ADD WHOLE PARTS INVOICE</p><div className="invoice-entry-grid"><label>Vendor<input value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })}/></label><label>Invoice number<input value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })}/></label><label>Invoice date<input type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })}/></label><label>Invoice total<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></label><label>Note<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></label></div><button className="primary-button" disabled={busy} onClick={() => void addInvoice()} type="button">Post invoice to RO {selected.ro_number}</button></div>
        <div className="invoice-list"><p className="section-label">PARTS INVOICES</p>{invoices.filter((invoice) => invoice.category === "parts").map((invoice) => <article key={invoice.id}><div><strong>{invoice.vendor || ""}</strong><span>{invoice.invoice_number || ""} · {invoice.invoice_date || ""}</span></div><strong>{money(invoice.amount)}</strong></article>)}</div>
      </>}</section>
    </div>
  </>;
}
