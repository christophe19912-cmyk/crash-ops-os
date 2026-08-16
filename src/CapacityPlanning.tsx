import { useMemo, useState } from "react";
import { buildCapacityPlan } from "./engine/capacityPlanningEngine";
import {
  SHOP_OPTIONS,
  getCapacitySettings,
} from "./services/capacitySettings";
import {
  useImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function statusClass(status: string) {
  if (status === "Healthy") return "good";
  if (status === "Capture Keys") return "good";
  if (status === "Flow Delay") return "warning";
  return "alert";
}

function CapacityPlanning() {
  const importedRecord = useImportedWip();

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const importedShop = repairOrders[0]?.shop;

  const [selectedShop, setSelectedShop] = useState(
    importedShop && SHOP_OPTIONS.includes(importedShop)
      ? importedShop
      : "North Hills",
  );

  const settings = getCapacitySettings(selectedShop);

  const plan = useMemo(
    () =>
      buildCapacityPlan(
        selectedShop,
        repairOrders,
        settings,
      ),
    [selectedShop, repairOrders, settings],
  );

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              CAPACITY ENGINE V2
            </p>

            <h2>Capacity Planning</h2>

            <p className="page-description">
              Build a five-day drop and severity plan from
              imported WIP and store capacity settings.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">CP</div>
          <h3>No imported WIP report found</h3>
          <p>
            Import and apply a WIP report before generating a
            capacity plan.
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
            CAPACITY ENGINE V2
          </p>

          <h2>Capacity Planning</h2>

          <p className="page-description">
            Convert current WIP, configured output, and repair
            severity into a five-day scheduling recommendation.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) =>
              setSelectedShop(event.target.value)
            }
            value={selectedShop}
          >
            {SHOP_OPTIONS.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Active Repairs</p>
          <strong>{plan.activeRepairCount}</strong>
          <small>Completed holds excluded</small>
        </article>

        <article className="card">
          <p>Active WIP Hours</p>
          <strong>{plan.currentWipHours.toFixed(1)}</strong>
          <small>
            Current imported production workload
          </small>
        </article>

        <article className="card">
          <p>Healthy Capacity Available</p>
          <strong>
            {plan.availableHealthyCapacityHours.toFixed(0)}
          </strong>
          <small>Hours before the healthy target is reached</small>
        </article>

        <article className="card">
          <p>Recommended Weekly Drops</p>
          <strong>{plan.recommendedWeeklyDrops}</strong>
          <small>
            Limited by configured daily drop maximum
          </small>
        </article>
      </section>

      <section className="capacity-plan-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                FIVE-DAY DROP PLAN
              </p>
              <h3>{selectedShop}</h3>
            </div>
          </div>

          <div className="capacity-plan-table">
            <div className="capacity-plan-row capacity-plan-header">
              <span>Day</span>
              <span>Total</span>
              <span>Light</span>
              <span>Medium</span>
              <span>Heavy</span>
              <span>New Hours</span>
              <span>Projected WIP</span>
              <span>Status</span>
            </div>

            {plan.fiveDayPlan.map((day) => (
              <div
                className="capacity-plan-row"
                key={day.day}
              >
                <strong>{day.day}</strong>
                <span>{day.totalDrops}</span>
                <span>{day.lightDrops}</span>
                <span>{day.mediumDrops}</span>
                <span>{day.heavyDrops}</span>
                <span>{day.plannedLaborHours}</span>
                <span>{day.projectedWipHours}</span>
                <span
                  className={`status ${statusClass(
                    day.projectedStatus,
                  )}`}
                >
                  {day.projectedStatus}
                </span>

                <small>{day.note}</small>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                SEVERITY MIX
              </p>
              <h3>Recommended Intake</h3>
            </div>
          </div>

          <div className="capacity-mix-list">
            <div>
              <span>Light repairs</span>
              <strong>
                {plan.recommendedMix.light}
              </strong>
            </div>

            <div>
              <span>Medium repairs</span>
              <strong>
                {plan.recommendedMix.medium}
              </strong>
            </div>

            <div>
              <span>Heavy repairs</span>
              <strong>
                {plan.recommendedMix.heavy}
              </strong>
            </div>
          </div>

          <div className="wip-recommendation">
            <span>Planning summary</span>
            <p>{plan.summary}</p>
          </div>

          <div className="capacity-settings-reference">
            <span>Settings used</span>
            <p>
              {settings.weeklyLaborOutputTarget} weekly hours ·{" "}
              {settings.healthyWipWeeks} healthy WIP weeks ·{" "}
              {settings.maximumDailyDrops} max daily drops ·{" "}
              {settings.schedulingBufferPercent}% buffer
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}

export default CapacityPlanning;
