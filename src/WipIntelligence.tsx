import { useMemo, useState } from "react";
import CapacityIntegrationPanel from "./CapacityIntegrationPanel";
import type { RepairOrder } from "./models/RepairOrder";
import {
  daysSince,
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  isCompletedHold,
  isProductionHold,
} from "./services/stageDictionary";

type ShopSummary = {
  shop: string;
  repairOrders: RepairOrder[];
  vehicles: number;
  laborHours: number;
  preTaxTotal: number;
  averageLaborHours: number;
  holds: number;
  unassignedStages: number;
  missingTechnicians: number;
  averageDaysOnSite: number;
  stageCounts: Record<string, number>;
};



function buildShopSummaries(
  repairOrders: RepairOrder[],
): ShopSummary[] {
  const grouped = repairOrders.reduce<
    Record<string, RepairOrder[]>
  >((groups, repairOrder) => {
    const key = repairOrder.shop || "Unknown";

    if (!groups[key]) groups[key] = [];

    groups[key].push(repairOrder);

    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([shop, orders]) => {
      const activeOrders = orders.filter(
        (order) => !isCompletedHold(order.stage),
      );

      const laborHours = activeOrders.reduce(
        (total, order) => total + order.laborHours,
        0,
      );

      const preTaxTotal = activeOrders.reduce(
        (total, order) => total + order.preTaxTotal,
        0,
      );

      const stageCounts = orders.reduce<Record<string, number>>(
        (counts, order) => {
          counts[order.stage] = (counts[order.stage] || 0) + 1;
          return counts;
        },
        {},
      );

      const validAging = activeOrders
        .map((order) => daysSince(order.arrivalDate))
        .filter((value): value is number => value !== null);

      return {
        shop,
        repairOrders: orders,
        vehicles: activeOrders.length,
        laborHours,
        preTaxTotal,
        averageLaborHours:
          activeOrders.length > 0 ? laborHours / activeOrders.length : 0,
        holds: activeOrders.filter((order) => isProductionHold(order.stage))
          .length,
        unassignedStages: activeOrders.filter(
          (order) => order.stage === "Unassigned",
        ).length,
        missingTechnicians: activeOrders.filter(
          (order) => order.technician === "Unassigned",
        ).length,
        averageDaysOnSite:
          validAging.length > 0
            ? validAging.reduce(
                (total, value) => total + value,
                0,
              ) / validAging.length
            : 0,
        stageCounts,
      };
    })
    .sort((a, b) => b.laborHours - a.laborHours);
}

function getPressureStatus(summary: ShopSummary) {
  const holdRate =
    summary.vehicles > 0
      ? summary.holds / summary.vehicles
      : 0;

  if (
    summary.averageDaysOnSite >= 20 ||
    holdRate >= 0.25
  ) {
    return {
      label: "Immediate Attention",
      className: "alert",
      recommendation:
        "Perform a same-day WIP walk and assign an owner to every held or aging repair.",
    };
  }

  if (
    summary.averageDaysOnSite >= 12 ||
    holdRate >= 0.12
  ) {
    return {
      label: "Review Required",
      className: "warning",
      recommendation:
        "Review aging repairs, holds, and technician assignments before adding more work.",
    };
  }

  return {
    label: "Flow Stable",
    className: "good",
    recommendation:
      "Maintain current flow and review available capacity before increasing scheduled starts.",
  };
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
    detail:
      isProductionHold(order.stage)
        ? "This repair is currently identified as a hold."
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

  const [selectedOrder, setSelectedOrder] =
    useState<RepairOrder | null>(null);

  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const shopSummaries = useMemo(
    () => buildShopSummaries(repairOrders),
    [repairOrders],
  );

  const visibleSummaries =
    selectedShop === "All Locations"
      ? shopSummaries
      : shopSummaries.filter(
          (summary) => summary.shop === selectedShop,
        );

  const visibleOrders =
    selectedShop === "All Locations"
      ? repairOrders
      : repairOrders.filter(
          (order) => order.shop === selectedShop,
        );

  const totalLaborHours = visibleOrders.reduce(
    (total, order) => total + order.laborHours,
    0,
  );

  const totalHolds = visibleOrders.filter((order) =>
    isProductionHold(order.stage),
  ).length;

  const agingOrders = visibleOrders
    .map((order) => ({
      order,
      days: daysSince(order.arrivalDate),
    }))
    .filter(
      (
        item,
      ): item is { order: RepairOrder; days: number } =>
        item.days !== null,
    )
    .sort((a, b) => b.days - a.days);

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKLOAD INTELLIGENCE</p>
            <h2>WIP Intelligence</h2>
            <p className="page-description">
              Analyze imported Nexsyis repair-order data.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">WIP</div>
          <h3>No imported WIP report found</h3>
          <p>
            Open Import Center, upload a Nexsyis WIP CSV, and select
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
          <p className="eyebrow">IMPORTED OPERATIONS DATA</p>
          <h2>WIP Intelligence</h2>
          <p className="page-description">
            Analyze workload, holds, production stages, aging, and
            repair-level operational risk.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setSelectedOrder(null);
            }}
            value={selectedShop}
          >
            <option>All Locations</option>

            {shopSummaries.map((summary) => (
              <option key={summary.shop}>
                {summary.shop}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Vehicles On Site</p>
          <strong>{visibleOrders.length}</strong>
          <small>Imported active repair orders</small>
        </article>

        <article className="card">
          <p>Labor Hours In Process</p>
          <strong>
            {totalLaborHours.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
          <small>Total labor represented</small>
        </article>

        <article className="card">
          <p>Jobs On Hold</p>
          <strong>{totalHolds}</strong>
          <small>HOLD and C/HLD stages</small>
        </article>

        <article className="card">
          <p>Longest On Site</p>
          <strong>
            {agingOrders.length > 0
              ? `${agingOrders[0].days} days`
              : "Unknown"}
          </strong>
          <small>
            Based on valid arrival dates
          </small>
        </article>
      </section>

      <CapacityIntegrationPanel
        repairOrders={repairOrders}
        selectedShop={selectedShop}
        title="WIP Capacity Position"
      />

      <section className="wip-shop-grid">
        {visibleSummaries.map((summary) => {
          const pressure = getPressureStatus(summary);

          return (
            <article
              className="panel wip-intelligence-card"
              key={summary.shop}
            >
              <div className="wip-intelligence-header">
                <div>
                  <p className="section-label">SHOP WIP</p>
                  <h3>{summary.shop}</h3>
                </div>

                <span
                  className={`status ${pressure.className}`}
                >
                  {pressure.label}
                </span>
              </div>

              <div className="wip-intelligence-metrics">
                <div>
                  <span>Vehicles</span>
                  <strong>{summary.vehicles}</strong>
                </div>

                <div>
                  <span>Labor Hours</span>
                  <strong>
                    {summary.laborHours.toFixed(1)}
                  </strong>
                </div>

                <div>
                  <span>Average RO Hours</span>
                  <strong>
                    {summary.averageLaborHours.toFixed(1)}
                  </strong>
                </div>

                <div>
                  <span>Average Days On Site</span>
                  <strong>
                    {summary.averageDaysOnSite.toFixed(1)}
                  </strong>
                </div>

                <div>
                  <span>Held Jobs</span>
                  <strong>{summary.holds}</strong>
                </div>

                <div>
                  <span>Missing Technician</span>
                  <strong>
                    {summary.missingTechnicians}
                  </strong>
                </div>
              </div>

              <div className="wip-recommendation">
                <span>Recommended action</span>
                <p>{pressure.recommendation}</p>
              </div>

              <div className="stage-summary-list">
                {Object.entries(summary.stageCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([stage, count]) => (
                    <div key={stage}>
                      <span>{stage}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel wip-repair-table-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">REPAIR-LEVEL ANALYSIS</p>
            <h3>Imported Repair Orders</h3>
          </div>
        </div>

        <div className="wip-repair-table-wrapper">
          <div className="wip-repair-table">
            <div className="wip-repair-row wip-repair-row-header">
              <span>RO</span>
              <span>Vehicle</span>
              <span>Stage</span>
              <span>Days On Site</span>
              <span>Labor Hours</span>
              <span>Technician</span>
              <span>Estimator</span>
              <span>Action</span>
            </div>

            {visibleOrders
              .slice()
              .sort(
                (a, b) =>
                  (daysSince(b.arrivalDate) || 0) -
                  (daysSince(a.arrivalDate) || 0),
              )
              .map((order, index) => (
                <div
                  className="wip-repair-row"
                  key={`${order.roNumber}-${index}`}
                >
                  <strong>{order.roNumber}</strong>
                  <span>{order.vehicle}</span>

                  <span
                    className={
                      isProductionHold(order.stage)
                        ? "stage-hold"
                        : ""
                    }
                  >
                    {order.stage}
                  </span>

                  <span>
                    {daysSince(order.arrivalDate) ?? "—"}
                  </span>

                  <span>{order.laborHours.toFixed(1)}</span>
                  <span>{order.technician}</span>
                  <span>{order.estimator}</span>

                  <button
                    className="text-button"
                    onClick={() => setSelectedOrder(order)}
                    type="button"
                  >
                    View Timeline
                  </button>
                </div>
              ))}
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
                Current timeline derived from the imported Nexsyis
                report. More detailed stage history will become
                available when event-level data is integrated.
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
