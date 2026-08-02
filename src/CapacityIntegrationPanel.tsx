import { useMemo } from "react";
import type { RepairOrder } from "./models/RepairOrder";
import { buildCapacityPlan } from "./engine/capacityPlanningEngine";
import { evaluateCapacity } from "./engine/capacityEngine";
import { getCapacitySettings } from "./services/capacitySettings";
import { isCompletedHold } from "./services/stageDictionary";

type CapacityIntegrationPanelProps = {
  repairOrders: RepairOrder[];
  selectedShop?: string;
  compact?: boolean;
  title?: string;
};

function statusClass(status: string) {
  if (status === "Healthy" || status === "Capture Keys") {
    return "good";
  }

  if (status === "Flow Delay") {
    return "warning";
  }

  return "alert";
}

function CapacityIntegrationPanel({
  repairOrders,
  selectedShop = "All Locations",
  compact = false,
  title = "Capacity Intelligence",
}: CapacityIntegrationPanelProps) {
  const shops = useMemo(
    () =>
      Array.from(
        new Set(repairOrders.map((order) => order.shop)),
      ).filter(Boolean),
    [repairOrders],
  );

  const visibleShops =
    selectedShop === "All Locations"
      ? shops
      : shops.filter((shop) => shop === selectedShop);

  const snapshots = visibleShops.map((shop) => {
    const settings = getCapacitySettings(shop);

    const shopOrders = repairOrders.filter(
      (order) => order.shop === shop,
    );

    const activeOrders = shopOrders.filter(
      (order) => !isCompletedHold(order.stage),
    );

    const activeHours = activeOrders.reduce(
      (total, order) => total + order.laborHours,
      0,
    );

    const evaluation = evaluateCapacity(
      {
        hoursInProcess: activeHours,
        vehiclesOnsite: activeOrders.length,
      },
      settings,
    );

    const plan = buildCapacityPlan(
      shop,
      repairOrders,
      settings,
    );

    return {
      shop,
      activeOrders,
      activeHours,
      evaluation,
      plan,
    };
  });

  if (snapshots.length === 0) return null;

  return (
    <section
      className={
        compact
          ? "panel capacity-integration compact"
          : "panel capacity-integration"
      }
    >
      <div className="panel-header">
        <div>
          <p className="section-label">
            CAPACITY ENGINE V2
          </p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="capacity-integration-grid">
        {snapshots.map((snapshot) => {
          const today = snapshot.plan.fiveDayPlan[0];

          return (
            <article
              className="capacity-integration-shop"
              key={snapshot.shop}
            >
              <div className="capacity-integration-heading">
                <div>
                  <strong>{snapshot.shop}</strong>
                  <span>
                    {snapshot.activeOrders.length} active repairs ·{" "}
                    {snapshot.activeHours.toFixed(1)} hours
                  </span>
                </div>

                <span
                  className={`status ${statusClass(
                    snapshot.evaluation.status,
                  )}`}
                >
                  {snapshot.evaluation.status}
                </span>
              </div>

              <div className="capacity-integration-metrics">
                <div>
                  <span>Healthy WIP</span>
                  <strong>
                    {snapshot.evaluation.targetWipHours} hrs
                  </strong>
                </div>

                <div>
                  <span>Maximum WIP</span>
                  <strong>
                    {snapshot.evaluation.maximumWipHours} hrs
                  </strong>
                </div>

                <div>
                  <span>Weeks to Clear</span>
                  <strong>
                    {snapshot.evaluation.weeksToClear}
                  </strong>
                </div>

                <div>
                  <span>Load</span>
                  <strong>
                    {snapshot.evaluation.loadPercent}%
                  </strong>
                </div>

                <div>
                  <span>Bay Pressure</span>
                  <strong>
                    {snapshot.evaluation.bayPressure}
                  </strong>
                </div>

                <div>
                  <span>Weekly Drops</span>
                  <strong>
                    {snapshot.plan.recommendedWeeklyDrops}
                  </strong>
                </div>
              </div>

              <div className="capacity-drop-action">
                <div>
                  <span>Today's intake recommendation</span>
                  <strong>{today.totalDrops} drops</strong>
                </div>

                <p>
                  {today.lightDrops} light ·{" "}
                  {today.mediumDrops} medium ·{" "}
                  {today.heavyDrops} heavy
                </p>

                <small>{today.note}</small>
              </div>

              {!compact && (
                <div className="capacity-integration-recommendation">
                  <span>Operating recommendation</span>
                  <p>{snapshot.evaluation.recommendation}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CapacityIntegrationPanel;
