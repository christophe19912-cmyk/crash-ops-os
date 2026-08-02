import { useMemo, useState } from "react";
import type {
  RepairSeverity,
  ScheduleDay,
  ScheduledDrop,
} from "./models/ScheduledDrop";
import {
  buildIntelligenceSnapshot,
} from "./engine/intelligence/intelligenceEngine";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  SCHEDULE_DAYS,
  addScheduledDrop,
  deleteScheduledDrop,
  loadScheduledDrops,
  updateScheduledDrop,
} from "./services/scheduleStorage";

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

function severityClass(severity: RepairSeverity) {
  return severity.toLowerCase();
}

function capacityStatusClass(status: string) {
  if (status === "Healthy" || status === "Capture Keys") {
    return "good";
  }

  if (status === "Flow Delay") {
    return "warning";
  }

  return "alert";
}

function SchedulingBoard() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const initialShop =
    intelligence.shops[0]?.shop || "North Hills";

  const [selectedShop, setSelectedShop] =
    useState(initialShop);

  const [drops, setDrops] = useState<ScheduledDrop[]>(
    loadScheduledDrops,
  );

  const [form, setForm] = useState<DropForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const shopIntelligence =
    intelligence.shops.find(
      (shop) => shop.shop === selectedShop,
    ) || intelligence.shops[0];

  const shopDrops = drops.filter(
    (drop) => drop.shop === selectedShop,
  );

  const scheduledHours = shopDrops.reduce(
    (total, drop) =>
      total + drop.estimatedLaborHours,
    0,
  );

  const recommendedPlan =
    shopIntelligence?.capacityPlan;

  const recommendedHours =
    recommendedPlan?.fiveDayPlan.reduce(
      (total, day) =>
        total + day.plannedLaborHours,
      0,
    ) || 0;

  const weeklyVariance =
    scheduledHours - recommendedHours;

  function setFormField<K extends keyof DropForm>(
    key: K,
    value: DropForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submitDrop() {
    const hours = Number(form.estimatedLaborHours);

    if (!Number.isFinite(hours) || hours <= 0) {
      window.alert(
        "Enter estimated labor hours greater than zero.",
      );
      return;
    }

    const next = addScheduledDrop(drops, {
      shop: selectedShop,
      day: form.day,
      customer:
        form.customer.trim() || "Customer TBD",
      vehicle:
        form.vehicle.trim() || "Vehicle TBD",
      roNumber:
        form.roNumber.trim() || "Pending",
      estimatedLaborHours: hours,
      severity: form.severity,
      notes: form.notes.trim(),
    });

    setDrops(next);
    setForm(emptyForm);
    setShowForm(false);
  }

  function moveDrop(
    drop: ScheduledDrop,
    day: ScheduleDay,
  ) {
    setDrops(
      updateScheduledDrop(drops, {
        ...drop,
        day,
      }),
    );
  }

  function removeDrop(id: string) {
    setDrops(deleteScheduledDrop(drops, id));
  }

  if (
    !importedRecord ||
    repairOrders.length === 0 ||
    !shopIntelligence ||
    !recommendedPlan
  ) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              INTELLIGENCE CORE · SCHEDULING
            </p>
            <h2>Editable Scheduling Board</h2>
            <p className="page-description">
              Build a weekly drop plan from shared capacity
              intelligence.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">SC</div>
          <h3>No imported WIP data found</h3>
          <p>
            Apply a WIP import before building a capacity-aware
            schedule.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            INTELLIGENCE CORE · CAPACITY-AWARE SCHEDULING
          </p>

          <h2>Editable Scheduling Board</h2>

          <p className="page-description">
            Build the weekly drop plan and compare scheduled intake
            against the same Intelligence Snapshot used by Mission
            Control, dAIly Report, WIP Intelligence, and Production
            Board.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setShowForm(false);
            }}
            value={selectedShop}
          >
            {intelligence.shops.map((shop) => (
              <option key={shop.shop} value={shop.shop}>
                {shop.shop}
              </option>
            ))}
          </select>

          <button
            className="primary-button"
            onClick={() =>
              setShowForm((current) => !current)
            }
            type="button"
          >
            {showForm ? "Close Form" : "Add Drop"}
          </button>
        </div>
      </header>

      <section className="scheduling-summary-grid">
        <article className="card">
          <p>Capacity Status</p>
          <strong>{shopIntelligence.capacity.status}</strong>
          <small>
            {shopIntelligence.capacity.weeksToClear} weeks to clear
          </small>
        </article>

        <article className="card">
          <p>Recommended Weekly Drops</p>
          <strong>
            {recommendedPlan.recommendedWeeklyDrops}
          </strong>
          <small>Shared Intelligence Core guidance</small>
        </article>

        <article className="card">
          <p>Actually Scheduled</p>
          <strong>{shopDrops.length}</strong>
          <small>
            {scheduledHours.toFixed(1)} labor hours
          </small>
        </article>

        <article className="card">
          <p>Schedule Variance</p>
          <strong>
            {weeklyVariance > 0 ? "+" : ""}
            {weeklyVariance.toFixed(0)}
          </strong>
          <small>
            {weeklyVariance > 0
              ? "Hours above recommendation"
              : "Hours below recommendation"}
          </small>
        </article>
      </section>

      <section className="panel scheduling-core-context">
        <div className="scheduling-core-context-grid">
          <div>
            <span>Active repairs</span>
            <strong>
              {shopIntelligence.activeRepairCount}
            </strong>
          </div>

          <div>
            <span>Active WIP hours</span>
            <strong>
              {shopIntelligence.activeLaborHours.toFixed(1)}
            </strong>
          </div>

          <div>
            <span>Healthy WIP target</span>
            <strong>
              {shopIntelligence.capacity.targetWipHours} hrs
            </strong>
          </div>

          <div>
            <span>Maximum WIP</span>
            <strong>
              {shopIntelligence.capacity.maximumWipHours} hrs
            </strong>
          </div>

          <div>
            <span>Load</span>
            <strong>
              {shopIntelligence.capacity.loadPercent}%
            </strong>
          </div>

          <div>
            <span>Bay pressure</span>
            <strong>
              {shopIntelligence.capacity.bayPressure}
            </strong>
          </div>
        </div>

        <div className="wip-recommendation">
          <span>Intelligence Core recommendation</span>
          <p>
            {shopIntelligence.capacity.recommendation}
          </p>
        </div>
      </section>

      {showForm && (
        <section className="panel scheduling-form-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">NEW DROP</p>
              <h3>Add Scheduled Repair</h3>
            </div>
          </div>

          <div className="scheduling-form-grid">
            <label>
              <span>Day</span>
              <select
                onChange={(event) =>
                  setFormField(
                    "day",
                    event.target.value as ScheduleDay,
                  )
                }
                value={form.day}
              >
                {SCHEDULE_DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>

            <label>
              <span>RO Number</span>
              <input
                onChange={(event) =>
                  setFormField(
                    "roNumber",
                    event.target.value,
                  )
                }
                placeholder="Pending or RO number"
                value={form.roNumber}
              />
            </label>

            <label>
              <span>Customer</span>
              <input
                onChange={(event) =>
                  setFormField(
                    "customer",
                    event.target.value,
                  )
                }
                placeholder="Customer name"
                value={form.customer}
              />
            </label>

            <label>
              <span>Vehicle</span>
              <input
                onChange={(event) =>
                  setFormField(
                    "vehicle",
                    event.target.value,
                  )
                }
                placeholder="Year make model"
                value={form.vehicle}
              />
            </label>

            <label>
              <span>Estimated Labor Hours</span>
              <input
                min="0.1"
                onChange={(event) =>
                  setFormField(
                    "estimatedLaborHours",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={form.estimatedLaborHours}
              />
            </label>

            <label>
              <span>Severity</span>
              <select
                onChange={(event) =>
                  setFormField(
                    "severity",
                    event.target.value as RepairSeverity,
                  )
                }
                value={form.severity}
              >
                <option>Light</option>
                <option>Medium</option>
                <option>Heavy</option>
              </select>
            </label>

            <label className="scheduling-notes-field">
              <span>Notes</span>
              <input
                onChange={(event) =>
                  setFormField(
                    "notes",
                    event.target.value,
                  )
                }
                placeholder="Insurance, parts, tow-in, or scheduling notes"
                value={form.notes}
              />
            </label>
          </div>

          <div className="scheduling-form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setForm(emptyForm);
                setShowForm(false);
              }}
              type="button"
            >
              Cancel
            </button>

            <button
              className="primary-button"
              onClick={submitDrop}
              type="button"
            >
              Save Drop
            </button>
          </div>
        </section>
      )}

      <section className="scheduling-board-wrapper">
        <div className="scheduling-board">
          {SCHEDULE_DAYS.map((day, index) => {
            const dayDrops = shopDrops.filter(
              (drop) => drop.day === day,
            );

            const scheduledDayHours = dayDrops.reduce(
              (total, drop) =>
                total + drop.estimatedLaborHours,
              0,
            );

            const recommendedDay =
              recommendedPlan.fiveDayPlan[index];

            const overloaded =
              scheduledDayHours >
              recommendedDay.plannedLaborHours;

            return (
              <section
                className="scheduling-day-column"
                key={day}
              >
                <div className="scheduling-day-header">
                  <div>
                    <h3>{day}</h3>
                    <span>
                      {dayDrops.length} drops ·{" "}
                      {scheduledDayHours.toFixed(1)} hrs
                    </span>
                  </div>

                  <span
                    className={`status ${capacityStatusClass(
                      overloaded
                        ? "True Overload"
                        : recommendedDay.projectedStatus,
                    )}`}
                  >
                    {overloaded
                      ? "Above Plan"
                      : recommendedDay.projectedStatus}
                  </span>
                </div>

                <div className="scheduling-day-guidance">
                  <span>Intelligence guidance</span>
                  <strong>
                    {recommendedDay.totalDrops} drops ·{" "}
                    {recommendedDay.plannedLaborHours} hrs
                  </strong>
                  <small>
                    {recommendedDay.lightDrops} light ·{" "}
                    {recommendedDay.mediumDrops} medium ·{" "}
                    {recommendedDay.heavyDrops} heavy
                  </small>
                </div>

                <div className="scheduling-drop-list">
                  {dayDrops.length === 0 ? (
                    <div className="scheduling-empty-day">
                      No drops scheduled
                    </div>
                  ) : (
                    dayDrops.map((drop) => (
                      <article
                        className={`scheduled-drop-card ${severityClass(
                          drop.severity,
                        )}`}
                        key={drop.id}
                      >
                        <div className="scheduled-drop-heading">
                          <div>
                            <strong>
                              RO {drop.roNumber}
                            </strong>
                            <span>{drop.vehicle}</span>
                          </div>

                          <span
                            className={`severity-pill ${severityClass(
                              drop.severity,
                            )}`}
                          >
                            {drop.severity}
                          </span>
                        </div>

                        <p>{drop.customer}</p>

                        <div className="scheduled-drop-hours">
                          <span>Estimated labor</span>
                          <strong>
                            {drop.estimatedLaborHours.toFixed(
                              1,
                            )}{" "}
                            hrs
                          </strong>
                        </div>

                        {drop.notes && (
                          <small>{drop.notes}</small>
                        )}

                        <label className="scheduled-drop-move">
                          <span>Move to</span>
                          <select
                            onChange={(event) =>
                              moveDrop(
                                drop,
                                event.target
                                  .value as ScheduleDay,
                              )
                            }
                            value={drop.day}
                          >
                            {SCHEDULE_DAYS.map(
                              (availableDay) => (
                                <option key={availableDay}>
                                  {availableDay}
                                </option>
                              ),
                            )}
                          </select>
                        </label>

                        <button
                          className="text-button scheduled-delete"
                          onClick={() =>
                            removeDrop(drop.id)
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel scheduling-week-summary">
        <div>
          <p className="section-label">
            WEEKLY INTELLIGENCE CHECK
          </p>
          <h3>
            {weeklyVariance > 0
              ? "Scheduled intake is above guidance"
              : "Scheduled intake is within guidance"}
          </h3>
          <p>
            {weeklyVariance > 0
              ? `Move or reduce approximately ${weeklyVariance.toFixed(
                  0,
                )} labor hours to return to the Intelligence Core recommendation.`
              : `The schedule remains ${Math.abs(
                  weeklyVariance,
                ).toFixed(
                  0,
                )} labor hours below the current recommendation.`}
          </p>
        </div>
      </section>
    </>
  );
}

export default SchedulingBoard;
