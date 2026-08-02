import { useMemo, useState } from "react";
import type { RepairSeverity, ScheduleDay, ScheduledDrop } from "./models/ScheduledDrop";
import { buildCapacityPlan } from "./engine/capacityPlanningEngine";
import { SHOP_OPTIONS, getCapacitySettings } from "./services/capacitySettings";
import { loadImportedWip, normalizeRepairOrders } from "./services/importedData";
import { SCHEDULE_DAYS, addScheduledDrop, deleteScheduledDrop, loadScheduledDrops, updateScheduledDrop } from "./services/scheduleStorage";

type DropForm = {
  day: ScheduleDay;
  customer: string;
  vehicle: string;
  roNumber: string;
  estimatedLaborHours: string;
  severity: RepairSeverity;
  notes: string;
};

const emptyForm: DropForm = {
  day: "Monday",
  customer: "",
  vehicle: "",
  roNumber: "",
  estimatedLaborHours: "30",
  severity: "Medium",
  notes: "",
};

function statusClass(over: boolean, status: string) {
  if (over) return "alert";
  if (status === "Flow Delay") return "warning";
  if (status === "True Overload") return "alert";
  return "good";
}

function SchedulingBoard() {
  const imported = useMemo(loadImportedWip, []);
  const repairOrders = useMemo(() => normalizeRepairOrders(imported), [imported]);
  const importedShop = repairOrders[0]?.shop;
  const [selectedShop, setSelectedShop] = useState(importedShop && SHOP_OPTIONS.includes(importedShop) ? importedShop : "North Hills");
  const [drops, setDrops] = useState<ScheduledDrop[]>(loadScheduledDrops);
  const [form, setForm] = useState<DropForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const settings = getCapacitySettings(selectedShop);
  const plan = useMemo(() => buildCapacityPlan(selectedShop, repairOrders, settings), [selectedShop, repairOrders, settings]);
  const shopDrops = drops.filter((drop) => drop.shop === selectedShop);
  const scheduledHours = shopDrops.reduce((total, drop) => total + drop.estimatedLaborHours, 0);
  const recommendedHours = plan.fiveDayPlan.reduce((total, day) => total + day.plannedLaborHours, 0);
  const variance = scheduledHours - recommendedHours;

  function updateForm<K extends keyof DropForm>(key: K, value: DropForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveDrop() {
    const hours = Number(form.estimatedLaborHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      window.alert("Enter labor hours greater than zero.");
      return;
    }

    setDrops(addScheduledDrop(drops, {
      shop: selectedShop,
      day: form.day,
      customer: form.customer.trim() || "Customer TBD",
      vehicle: form.vehicle.trim() || "Vehicle TBD",
      roNumber: form.roNumber.trim() || "Pending",
      estimatedLaborHours: hours,
      severity: form.severity,
      notes: form.notes.trim(),
    }));
    setForm(emptyForm);
    setShowForm(false);
  }

  function moveDrop(drop: ScheduledDrop, day: ScheduleDay) {
    setDrops(updateScheduledDrop(drops, { ...drop, day }));
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">CAPACITY-AWARE SCHEDULING</p>
          <h2>Editable Scheduling Board</h2>
          <p className="page-description">Build the weekly drop plan and compare scheduled intake against Capacity Engine guidance.</p>
        </div>
        <div className="header-actions">
          <select className="report-selector" value={selectedShop} onChange={(event) => setSelectedShop(event.target.value)}>
            {SHOP_OPTIONS.map((shop) => <option key={shop}>{shop}</option>)}
          </select>
          <button className="primary-button" type="button" onClick={() => setShowForm((current) => !current)}>
            {showForm ? "Close Form" : "Add Drop"}
          </button>
        </div>
      </header>

      <section className="scheduling-summary-grid">
        <article className="card"><p>Recommended Weekly Drops</p><strong>{plan.recommendedWeeklyDrops}</strong><small>Capacity Engine recommendation</small></article>
        <article className="card"><p>Actually Scheduled</p><strong>{shopDrops.length}</strong><small>{scheduledHours.toFixed(1)} labor hours</small></article>
        <article className="card"><p>Recommended Intake Hours</p><strong>{recommendedHours.toFixed(0)}</strong><small>Based on recommended mix</small></article>
        <article className="card"><p>Schedule Variance</p><strong>{variance > 0 ? "+" : ""}{variance.toFixed(0)}</strong><small>{variance > 0 ? "Hours above plan" : "Hours below plan"}</small></article>
      </section>

      {showForm && (
        <section className="panel scheduling-form-panel">
          <div className="panel-header"><div><p className="section-label">NEW DROP</p><h3>Add Scheduled Repair</h3></div></div>
          <div className="scheduling-form-grid">
            <label><span>Day</span><select value={form.day} onChange={(event) => updateForm("day", event.target.value as ScheduleDay)}>{SCHEDULE_DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
            <label><span>RO Number</span><input value={form.roNumber} onChange={(event) => updateForm("roNumber", event.target.value)} /></label>
            <label><span>Customer</span><input value={form.customer} onChange={(event) => updateForm("customer", event.target.value)} /></label>
            <label><span>Vehicle</span><input value={form.vehicle} onChange={(event) => updateForm("vehicle", event.target.value)} /></label>
            <label><span>Estimated Labor Hours</span><input type="number" min="0.1" step="0.1" value={form.estimatedLaborHours} onChange={(event) => updateForm("estimatedLaborHours", event.target.value)} /></label>
            <label><span>Severity</span><select value={form.severity} onChange={(event) => updateForm("severity", event.target.value as RepairSeverity)}><option>Light</option><option>Medium</option><option>Heavy</option></select></label>
            <label className="scheduling-notes-field"><span>Notes</span><input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
          </div>
          <div className="scheduling-form-actions"><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" type="button" onClick={saveDrop}>Save Drop</button></div>
        </section>
      )}

      <section className="scheduling-board-wrapper">
        <div className="scheduling-board">
          {SCHEDULE_DAYS.map((day, index) => {
            const dayDrops = shopDrops.filter((drop) => drop.day === day);
            const dayHours = dayDrops.reduce((total, drop) => total + drop.estimatedLaborHours, 0);
            const guidance = plan.fiveDayPlan[index];
            const over = dayHours > guidance.plannedLaborHours;
            return (
              <section className="scheduling-day-column" key={day}>
                <div className="scheduling-day-header"><div><h3>{day}</h3><span>{dayDrops.length} drops · {dayHours.toFixed(1)} hrs</span></div><span className={`status ${statusClass(over, guidance.projectedStatus)}`}>{over ? "Above Plan" : guidance.projectedStatus}</span></div>
                <div className="scheduling-day-guidance"><span>Capacity guidance</span><strong>{guidance.totalDrops} drops · {guidance.plannedLaborHours} hrs</strong><small>{guidance.lightDrops} light · {guidance.mediumDrops} medium · {guidance.heavyDrops} heavy</small></div>
                <div className="scheduling-drop-list">
                  {dayDrops.length === 0 ? <div className="scheduling-empty-day">No drops scheduled</div> : dayDrops.map((drop) => (
                    <article className={`scheduled-drop-card ${drop.severity.toLowerCase()}`} key={drop.id}>
                      <div className="scheduled-drop-heading"><div><strong>RO {drop.roNumber}</strong><span>{drop.vehicle}</span></div><span className={`severity-pill ${drop.severity.toLowerCase()}`}>{drop.severity}</span></div>
                      <p>{drop.customer}</p>
                      <div className="scheduled-drop-hours"><span>Estimated labor</span><strong>{drop.estimatedLaborHours.toFixed(1)} hrs</strong></div>
                      {drop.notes && <small>{drop.notes}</small>}
                      <label className="scheduled-drop-move"><span>Move to</span><select value={drop.day} onChange={(event) => moveDrop(drop, event.target.value as ScheduleDay)}>{SCHEDULE_DAYS.map((availableDay) => <option key={availableDay}>{availableDay}</option>)}</select></label>
                      <button className="text-button scheduled-delete" type="button" onClick={() => setDrops(deleteScheduledDrop(drops, drop.id))}>Remove</button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel scheduling-week-summary"><p className="section-label">WEEKLY CAPACITY CHECK</p><h3>{variance > 0 ? "Scheduled intake is above guidance" : "Scheduled intake is within guidance"}</h3><p>{variance > 0 ? `Move or reduce approximately ${variance.toFixed(0)} labor hours.` : `The schedule remains ${Math.abs(variance).toFixed(0)} labor hours below guidance.`}</p></section>
    </>
  );
}

export default SchedulingBoard;
