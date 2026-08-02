import { useMemo, useState } from "react";
import { buildIntelligenceSnapshot } from "./engine/intelligence/intelligenceEngine";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function statusClass(status: string) {
  if (status === "Low" || status === "Healthy") return "good";
  if (status === "Medium" || status === "Flow Delay") {
    return "warning";
  }
  return "alert";
}

function IntelligenceDiagnostics() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const snapshot = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const [showJson, setShowJson] = useState(false);

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">INTELLIGENCE CORE V1</p>
            <h2>Intelligence Diagnostics</h2>
            <p className="page-description">
              Inspect the shared operational snapshot before
              migrating production pages.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">IC</div>
          <h3>No imported WIP data found</h3>
          <p>
            Apply a WIP import before validating the
            Intelligence Core.
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
            CRASH OPS INTELLIGENCE CORE V1
          </p>
          <h2>Intelligence Diagnostics</h2>
          <p className="page-description">
            Validate the shared operational snapshot before
            connecting production pages.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={() => setShowJson((current) => !current)}
            type="button"
          >
            {showJson ? "Hide Snapshot JSON" : "View Snapshot JSON"}
          </button>
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Shops</p>
          <strong>{snapshot.summary.shopCount}</strong>
          <small>Locations in the shared snapshot</small>
        </article>

        <article className="card">
          <p>Active Repairs</p>
          <strong>{snapshot.summary.activeRepairCount}</strong>
          <small>Completed holds excluded</small>
        </article>

        <article className="card">
          <p>Active Labor Hours</p>
          <strong>
            {snapshot.summary.activeLaborHours.toFixed(1)}
          </strong>
          <small>Shared production workload</small>
        </article>

        <article className="card">
          <p>Critical Alerts</p>
          <strong>{snapshot.summary.criticalAlertCount}</strong>
          <small>Capacity and operational risks</small>
        </article>
      </section>

      <section className="intelligence-diagnostics-grid">
        {snapshot.shops.map((shop) => (
          <article
            className="panel intelligence-shop-card"
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
                <span>Capacity</span>
                <strong>{shop.capacity.status}</strong>
              </div>
              <div>
                <span>Active Repairs</span>
                <strong>{shop.activeRepairCount}</strong>
              </div>
              <div>
                <span>Active Hours</span>
                <strong>{shop.activeLaborHours.toFixed(1)}</strong>
              </div>
              <div>
                <span>Weeks to Clear</span>
                <strong>{shop.capacity.weeksToClear}</strong>
              </div>
              <div>
                <span>Weekly Drops</span>
                <strong>
                  {shop.capacityPlan.recommendedWeeklyDrops}
                </strong>
              </div>
            </div>

            <div className="intelligence-alert-list">
              {shop.alerts.length === 0 ? (
                <p>No intelligence alerts were generated.</p>
              ) : (
                shop.alerts.map((alert) => (
                  <div
                    className={`intelligence-alert ${alert.severity.toLowerCase()}`}
                    key={alert.id}
                  >
                    <strong>{alert.title}</strong>
                    <p>{alert.explanation}</p>
                    <small>
                      Next: {alert.recommendedAction}
                    </small>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">
              SNAPSHOT PRIORITIES
            </p>
            <h3>Top Intelligence Recommendations</h3>
          </div>
        </div>

        <div className="engine-repair-list">
          {snapshot.recommendations
            .slice(0, 10)
            .map((recommendation) => (
              <article
                className="engine-repair-row"
                key={recommendation.id}
              >
                <div>
                  <strong>RO {recommendation.roNumber}</strong>
                  <span>{recommendation.vehicle}</span>
                </div>
                <div>
                  <span>Shop</span>
                  <strong>{recommendation.shop}</strong>
                </div>
                <div>
                  <span>Priority</span>
                  <strong>{recommendation.priority}</strong>
                </div>
                <div>
                  <span>Stage</span>
                  <strong>{recommendation.stage}</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{recommendation.owner}</strong>
                </div>
                <div>
                  <span>Action</span>
                  <strong>{recommendation.action}</strong>
                </div>
              </article>
            ))}
        </div>
      </section>

      {showJson && (
        <section className="panel intelligence-json-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                RAW INTELLIGENCE SNAPSHOT
              </p>
              <h3>Developer Diagnostics</h3>
            </div>
          </div>
          <pre>{JSON.stringify(snapshot, null, 2)}</pre>
        </section>
      )}
    </>
  );
}

export default IntelligenceDiagnostics;
