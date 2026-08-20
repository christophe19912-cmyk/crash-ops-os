import { useMemo, useState } from "react";
import type { RepairOrder } from "./models/RepairOrder";
import { buildIntelligenceSnapshot } from "./engine/intelligence";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import { isProductionHold } from "./services/stageDictionary";

function statusClass(status: string) {
  if (status === "Low" || status === "Healthy" || status === "Capture Keys") {
    return "good";
  }

  if (status === "Medium" || status === "Flow Delay") {
    return "warning";
  }

  return "alert";
}

function buildTimeline(order: RepairOrder) {
  const events = [];

  if (order.createdDate) {
    events.push({
      label: "Repair record created",
      date: order.createdDate,
      detail: "The repair entered the management system.",
    });
  }

  if (order.arrivalDate) {
    events.push({
      label: "Vehicle arrived",
      date: order.arrivalDate,
      detail: "The vehicle arrived onsite.",
    });
  }

  events.push({
    label: `Current stage: ${order.stage}`,
    date: "Current",
    detail: isProductionHold(order.stage)
      ? "This repair is currently identified as a production hold."
      : "This is the latest production stage in the imported report.",
  });

  if (order.completedDate) {
    events.push({
      label: "Repair completed",
      date: order.completedDate,
      detail: "A completed date is recorded.",
    });
  }

  return events;
}

function WipIntelligence() {
  const [selectedShop, setSelectedShop] =
    useState("All Locations");
  const [selectedTechnician, setSelectedTechnician] =
    useState("All Technicians");

  const [selectedOrder, setSelectedOrder] =
    useState<RepairOrder | null>(null);

  const importedRecord = useMemo(() => loadImportedWip(), []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const visibleShops =
    selectedShop === "All Locations"
      ? intelligence.shops
      : intelligence.shops.filter(
          (shop) => shop.shop === selectedShop,
        );

  const shopRepairs = useMemo(
    () =>
      selectedShop === "All Locations"
        ? intelligence.repairs
        : intelligence.repairs.filter(
            (repair) =>
              repair.repairOrder.shop === selectedShop,
          ),
    [intelligence.repairs, selectedShop],
  );

  const technicianSummaries = useMemo(() => {
    const grouped = shopRepairs
      .filter((repair) => repair.isActiveProduction)
      .reduce<Record<string, typeof shopRepairs>>(
        (groups, repair) => {
          const technician =
            repair.repairOrder.technician || "Unassigned";
          if (!groups[technician]) groups[technician] = [];
          groups[technician].push(repair);
          return groups;
        },
        {},
      );

    return Object.entries(grouped)
      .map(([technician, repairs]) => ({
        technician,
        jobs: repairs.length,
        laborHours: repairs.reduce(
          (total, repair) =>
            total + repair.repairOrder.laborHours,
          0,
        ),
      }))
      .sort((a, b) => b.laborHours - a.laborHours);
  }, [shopRepairs]);

  const visibleRepairs = useMemo(
    () =>
      selectedTechnician === "All Technicians"
        ? shopRepairs
        : shopRepairs.filter(
            (repair) =>
              repair.repairOrder.technician ===
              selectedTechnician,
          ),
    [selectedTechnician, shopRepairs],
  );


  const activeRepairs = visibleRepairs.filter(
    (repair) => repair.isActiveProduction,
  );

  const activeLaborHours = activeRepairs.reduce(
    (total, repair) =>
      total + repair.repairOrder.laborHours,
    0,
  );

  const productionHolds = visibleRepairs.filter(
    (repair) => repair.isProductionHold,
  ).length;

  const completedHolds = visibleRepairs.filter(
    (repair) => repair.isCompletedHold,
  ).length;

  const agingOrders = visibleRepairs
    .map((repair) => ({
      repair,
      days: repair.health.daysOnSite,
    }))
    .filter(
      (
        item,
      ): item is {
        repair: (typeof visibleRepairs)[number];
        days: number;
      } => item.days !== null,
    )
    .sort((a, b) => b.days - a.days);

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              INTELLIGENCE CORE · WORKLOAD
            </p>
            <h2>WIP Intelligence</h2>
            <p className="page-description">
              Analyze imported repair-order data through the shared
              Crash Ops Intelligence Snapshot.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">WIP</div>
          <h3>No imported WIP report found</h3>
          <p>
            Open Import Center, upload a WIP report, and select
            Apply Import.
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
            INTELLIGENCE CORE · WIP OPERATIONS
          </p>
          <h2>WIP Intelligence</h2>
          <p className="page-description">
            Review active workload, capacity position, repair risk,
            alerts, stages, and aging from one shared intelligence source.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setSelectedTechnician("All Technicians");
              setSelectedOrder(null);
            }}
            value={selectedShop}
          >
            <option>All Locations</option>

            {intelligence.shops.map((shop) => (
              <option key={shop.shop} value={shop.shop}>
                {shop.shop}
              </option>
            ))}
          </select>

          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedTechnician(event.target.value);
              setSelectedOrder(null);
            }}
            value={selectedTechnician}
          >
            <option>All Technicians</option>

            {technicianSummaries.map((summary) => (
              <option key={summary.technician}>
                {summary.technician}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Active Vehicles</p>
          <strong>{activeRepairs.length}</strong>
          <small>
            {completedHolds} completed holds excluded
          </small>
        </article>

        <article className="card">
          <p>Active Labor Hours</p>
          <strong>
            {activeLaborHours.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
          <small>Production workload from Intelligence Core</small>
        </article>

        <article className="card">
          <p>Production Holds</p>
          <strong>{productionHolds}</strong>
          <small>Active HOLD conditions</small>
        </article>

        <article className="card">
          <p>Longest On Site</p>
          <strong>
            {agingOrders.length > 0
              ? `${agingOrders[0].days} days`
              : "Unknown"}
          </strong>
          <small>Based on valid arrival dates</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">TECHNICIAN LOAD</p>
            <h3>Assigned WIP by Body Technician</h3>
          </div>
        </div>

        <div className="stage-summary-list">
          {technicianSummaries.map((summary) => (
            <div key={summary.technician}>
              <span>
                {summary.technician} · {summary.jobs} job
                {summary.jobs === 1 ? "" : "s"}
              </span>
              <strong>{summary.laborHours.toFixed(1)} hrs</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="wip-core-summary-grid">
        {visibleShops.map((shop) => (
          <article
            className="panel wip-core-summary"
            key={shop.shop}
          >
            <div className="wip-intelligence-header">
              <div>
                <p className="section-label">
                  SHOP INTELLIGENCE
                </p>
                <h3>{shop.shop}</h3>
              </div>

              <span
                className={`status ${statusClass(
                  shop.overallRisk,
                )}`}
              >
                {shop.overallRisk}
              </span>
            </div>

            <div className="wip-intelligence-metrics">
              <div>
                <span>Shop Health</span>
                <strong>{shop.health.healthScore}</strong>
              </div>

              <div>
                <span>Capacity Status</span>
                <strong>{shop.capacity.status}</strong>
              </div>

              <div>
                <span>Active Repairs</span>
                <strong>{shop.activeRepairCount}</strong>
              </div>

              <div>
                <span>Active Hours</span>
                <strong>
                  {shop.activeLaborHours.toFixed(1)}
                </strong>
              </div>

              <div>
                <span>Weeks to Clear</span>
                <strong>{shop.capacity.weeksToClear}</strong>
              </div>

              <div>
                <span>Load</span>
                <strong>{shop.capacity.loadPercent}%</strong>
              </div>

              <div>
                <span>Bay Pressure</span>
                <strong>{shop.capacity.bayPressure}</strong>
              </div>

              <div>
                <span>Weekly Drops</span>
                <strong>
                  {shop.capacityPlan.recommendedWeeklyDrops}
                </strong>
              </div>
            </div>

            <div className="wip-recommendation">
              <span>Capacity recommendation</span>
              <p>{shop.capacity.recommendation}</p>
            </div>

            <div className="wip-core-alerts">
              {shop.alerts.length === 0 ? (
                <p>No intelligence alerts were generated.</p>
              ) : (
                shop.alerts.map((alert) => (
                  <div key={alert.id}>
                    <span
                      className={`status ${statusClass(
                        alert.severity,
                      )}`}
                    >
                      {alert.severity}
                    </span>
                    <section>
                      <strong>{alert.title}</strong>
                      <p>{alert.explanation}</p>
                      <small>
                        Next: {alert.recommendedAction}
                      </small>
                    </section>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="panel wip-repair-table-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">
              REPAIR-LEVEL INTELLIGENCE
            </p>
            <h3>Imported Repair Orders</h3>
          </div>
        </div>

        <div className="wip-repair-table-wrapper">
          <div className="wip-repair-table wip-core-table">
            <div className="wip-repair-row wip-repair-row-header">
              <span>RO</span>
              <span>Vehicle</span>
              <span>Stage</span>
              <span>Days</span>
              <span>Labor</span>
              <span>Health</span>
              <span>Priority</span>
              <span>Risk</span>
              <span>Technician</span>
              <span>Action</span>
            </div>

            {visibleRepairs
              .slice()
              .sort((a, b) => {
                const priorityDifference =
                  b.health.priorityScore -
                  a.health.priorityScore;

                if (priorityDifference !== 0) {
                  return priorityDifference;
                }

                return (
                  (b.health.daysOnSite || 0) -
                  (a.health.daysOnSite || 0)
                );
              })
              .map((repair, index) => {
                const order = repair.repairOrder;

                return (
                  <div
                    className="wip-repair-row"
                    key={`${order.roNumber}-${index}`}
                  >
                    <strong>{order.roNumber}</strong>
                    <span>{order.vehicle}</span>

                    <span
                      className={
                        repair.isProductionHold
                          ? "stage-hold"
                          : ""
                      }
                    >
                      {order.stage}
                    </span>

                    <span>
                      {repair.health.daysOnSite ?? "—"}
                    </span>

                    <span>
                      {order.laborHours.toFixed(1)}
                    </span>

                    <span>
                      {repair.health.healthScore}
                    </span>

                    <span>
                      {repair.health.priorityScore}
                    </span>

                    <span
                      className={`status ${statusClass(
                        repair.health.riskLevel,
                      )}`}
                    >
                      {repair.health.riskLevel}
                    </span>

                    <span>{order.technician}</span>

                    <button
                      className="text-button"
                      onClick={() =>
                        setSelectedOrder(order)
                      }
                      type="button"
                    >
                      View Timeline
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {selectedOrder && (
        <section className="panel operational-timeline-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                OPERATIONAL TIMELINE
              </p>

              <h3>
                RO {selectedOrder.roNumber} —{" "}
                {selectedOrder.vehicle}
              </h3>

              <p className="panel-description">
                Current timeline derived from the imported report.
                Event-level stage history will become available when
                source-system event data is integrated.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => setSelectedOrder(null)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="operational-timeline">
            {buildTimeline(selectedOrder).map(
              (event, index) => (
                <div
                  className="timeline-event"
                  key={`${event.label}-${index}`}
                >
                  <div className="timeline-marker">
                    <span />
                  </div>

                  <div>
                    <strong>{event.label}</strong>
                    <span>{event.date}</span>
                    <p>{event.detail}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </>
  );
}

export default WipIntelligence;
