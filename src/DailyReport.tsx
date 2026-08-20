import { useEffect, useMemo, useState } from "react";
import { buildIntelligenceSnapshot } from "./engine/intelligence";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  loadActionItems,
  syncRecommendationActions,
  updateActionItem,
  type ActionItem,
  type ActionStatus,
} from "./services/operationsData";

function priorityClass(priority: string) {
  return priority.toLowerCase();
}

function alertClass(severity: string) {
  if (severity === "Info") return "good";
  if (severity === "Warning") return "warning";
  return "alert";
}

function DailyReport() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const shops = useMemo(
    () => intelligence.shops.map((shop) => shop.shop),
    [intelligence.shops],
  );

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const [generated, setGenerated] = useState(false);

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionStatus, setActionStatus] = useState<ActionStatus | "active" | "all">("active");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    void refreshActions();
  }, []);

  const visibleShops =
    selectedShop === "All Locations"
      ? intelligence.shops
      : intelligence.shops.filter(
          (shop) => shop.shop === selectedShop,
        );

  const recommendations =
    selectedShop === "All Locations"
      ? intelligence.recommendations
      : intelligence.recommendations.filter(
          (recommendation) =>
            recommendation.shop === selectedShop,
        );

  const alerts =
    selectedShop === "All Locations"
      ? intelligence.alerts
      : intelligence.alerts.filter(
          (alert) => alert.shop === selectedShop,
        );

  const priorityTotals = {
    critical: recommendations.filter(
      (item) => item.priority === "Critical",
    ).length,
    high: recommendations.filter(
      (item) => item.priority === "High",
    ).length,
    medium: recommendations.filter(
      (item) => item.priority === "Medium",
    ).length,
    low: recommendations.filter(
      (item) => item.priority === "Low",
    ).length,
  };

  const selectedRepairCount = visibleShops.reduce(
    (total, shop) => total + shop.repairs.length,
    0,
  );

  const selectedActiveHours = visibleShops.reduce(
    (total, shop) => total + shop.activeLaborHours,
    0,
  );

  const selectedWeeklyDrops = visibleShops.reduce(
    (total, shop) =>
      total + shop.capacityPlan.recommendedWeeklyDrops,
    0,
  );

  async function refreshActions() {
    try {
      setActionItems(await loadActionItems());
      setActionError("");
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Action items could not be loaded.");
    }
  }

  async function generateReport() {
    setGenerated(true);
    try {
      await syncRecommendationActions(recommendations);
      await refreshActions();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Action items could not be synchronized.");
    }
  }

  async function transitionAction(item: ActionItem, status: ActionStatus) {
    const reason = status === "dismissed" ? window.prompt("Why is this action being dismissed?") : undefined;
    if (status === "dismissed" && !reason) return;
    try {
      await updateActionItem(item.id, status, reason ?? undefined);
      await refreshActions();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The action could not be updated.");
    }
  }

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              ON-DEMAND OPERATIONS INTELLIGENCE
            </p>

            <h2>dAIly Report</h2>

            <p className="page-description">
              Generate an operating plan from the shared Crash Ops
              Intelligence Snapshot.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">AI</div>

          <h3>No imported WIP report found</h3>

          <p>
            Open Import Center, select the correct store, upload the
            WIP report, and click Apply Import.
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
            INTELLIGENCE CORE · DAILY OPERATING PLAN
          </p>

          <h2>dAIly Report</h2>

          <p className="page-description">
            Generate one prioritized operating plan from repair,
            capacity, health, alert, and recommendation intelligence.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setGenerated(false);
            }}
            value={selectedShop}
          >
            <option>All Locations</option>

            {shops.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>

          <button
            className="primary-button"
            onClick={() => void generateReport()}
            type="button"
          >
            Generate dAIly Report
          </button>
        </div>
      </header>

      <section className="panel daily-source-banner">
        <div>
          <span>Current data source</span>
          <strong>{importedRecord.fileName}</strong>
        </div>

        <div>
          <span>Selected scope</span>
          <strong>{selectedShop}</strong>
        </div>

        <div>
          <span>Repair orders analyzed</span>
          <strong>{selectedRepairCount}</strong>
        </div>

        <div>
          <span>Snapshot generated</span>
          <strong>
            {new Date(
              intelligence.generatedAt,
            ).toLocaleString()}
          </strong>
        </div>
      </section>

      {!generated ? (
        <section className="panel daily-empty">
          <div className="ai-mark">AI</div>

          <h3>Intelligence Snapshot is ready</h3>

          <p>
            Generate the report to combine repair priorities,
            production blockers, parts risk, delivery closeout,
            aging, and capacity direction into one task list.
          </p>
        </section>
      ) : (
        <>
          <section className="daily-summary-grid">
            <article className="panel daily-summary">
              <p className="section-label">
                EXECUTIVE SUMMARY
              </p>

              <h3>{selectedShop} operating plan</h3>

              <p>
                The Intelligence Core identified{" "}
                {priorityTotals.critical} critical,{" "}
                {priorityTotals.high} high-priority,{" "}
                {priorityTotals.medium} medium-priority, and{" "}
                {priorityTotals.low} low-priority repair actions.
              </p>
            </article>

            <article className="panel completion-card">
              <span>Tasks completed</span>

              <strong>
                {actionItems.filter((item) => item.status === "completed" && recommendations.some((recommendation) => recommendation.id === item.source_key)).length}{" "}
                / {recommendations.length}
              </strong>
            </article>
          </section>

          <section className="daily-intelligence-overview">
            <article className="card">
              <p>Active Labor Hours</p>
              <strong>{selectedActiveHours.toFixed(1)}</strong>
              <small>Completed holds excluded</small>
            </article>

            <article className="card">
              <p>Critical Alerts</p>
              <strong>
                {
                  alerts.filter(
                    (alert) =>
                      alert.severity === "Critical",
                  ).length
                }
              </strong>
              <small>Immediate operating conditions</small>
            </article>

            <article className="card">
              <p>Recommended Weekly Drops</p>
              <strong>{selectedWeeklyDrops}</strong>
              <small>Capacity-guided intake</small>
            </article>

            <article className="card">
              <p>Shops Reviewed</p>
              <strong>{visibleShops.length}</strong>
              <small>Locations in this report</small>
            </article>
          </section>

          <section className="panel daily-capacity-direction">
            <div className="panel-header">
              <div>
                <p className="section-label">
                  TODAY’S CAPACITY DIRECTION
                </p>
                <h3>Scheduling and Intake Actions</h3>
              </div>
            </div>

            <div className="daily-capacity-shop-list">
              {visibleShops.map((shop) => {
                const today =
                  shop.capacityPlan.fiveDayPlan[0];

                return (
                  <article key={shop.shop}>
                    <div>
                      <strong>{shop.shop}</strong>
                      <span>
                        {shop.capacity.status} ·{" "}
                        {shop.capacity.weeksToClear} weeks to clear
                      </span>
                    </div>

                    <div>
                      <strong>
                        {today.totalDrops} drops today
                      </strong>
                      <span>
                        {today.lightDrops} light ·{" "}
                        {today.mediumDrops} medium ·{" "}
                        {today.heavyDrops} heavy
                      </span>
                    </div>

                    <p>{shop.capacity.recommendation}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel daily-alert-section">
            <div className="panel-header">
              <div>
                <p className="section-label">
                  INTELLIGENCE ALERTS
                </p>
                <h3>Operating Conditions Requiring Attention</h3>
              </div>
            </div>

            <div className="daily-alert-list">
              {alerts.length === 0 ? (
                <p>No intelligence alerts were generated.</p>
              ) : (
                alerts.map((alert) => (
                  <article key={alert.id}>
                    <span
                      className={`status ${alertClass(
                        alert.severity,
                      )}`}
                    >
                      {alert.severity}
                    </span>

                    <div>
                      <strong>
                        {alert.shop} · {alert.title}
                      </strong>
                      <p>{alert.explanation}</p>
                      <small>
                        Next: {alert.recommendedAction}
                      </small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {actionError && <section className="panel import-error"><strong>Action history unavailable</strong><p>{actionError}</p></section>}

          <section className="panel daily-source-banner">
            <div><span>Action view</span><select className="report-selector" value={actionStatus} onChange={(event) => setActionStatus(event.target.value as ActionStatus | "active" | "all")}><option value="active">Open & in progress</option><option value="all">All actions</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option><option value="missed">Missed</option></select></div>
            <div><span>Missed actions</span><strong>{actionItems.filter((item) => item.status === "missed").length}</strong></div>
            <div><span>Dismissed (not missed)</span><strong>{actionItems.filter((item) => item.status === "dismissed").length}</strong></div>
          </section>

          {recommendations.length === 0 ? (
            <section className="panel daily-empty">
              <div className="ai-mark">AI</div>

              <h3>No repair actions were triggered</h3>

              <p>
                No repairs in the selected scope currently match the
                active blocker, aging, assignment, or blueprint rules.
              </p>
            </section>
          ) : (
            <section className="daily-task-list">
              {recommendations.map((recommendation) => {
                const action = actionItems.find((item) => item.source_key === recommendation.id);
                const completed = action?.status === "completed";
                const visible = actionStatus === "all" || (actionStatus === "active" && (!action || action.status === "open" || action.status === "in_progress")) || action?.status === actionStatus;
                if (!visible) return null;

                return (
                  <article
                    className={
                      completed
                        ? "panel daily-task completed"
                        : "panel daily-task"
                    }
                    key={recommendation.id}
                  >
                    <div className="daily-task-top">
                      <div>
                        <span
                          className={`priority-badge ${priorityClass(
                            recommendation.priority,
                          )}`}
                        >
                          {recommendation.priority}
                        </span>

                        <span className="shop-badge">
                          {recommendation.shop}
                        </span>

                        <span className="ro-badge">
                          RO {recommendation.roNumber}
                        </span>
                      </div>

                      <div className="header-actions">
                        {action && action.status === "open" && <button className="secondary-button" onClick={() => void transitionAction(action, "in_progress")} type="button">Start</button>}
                        {action && action.status !== "completed" && action.status !== "dismissed" && <button className="primary-button" onClick={() => void transitionAction(action, "completed")} type="button">Complete</button>}
                        {action && action.status !== "dismissed" && action.status !== "completed" && <button className="secondary-button" onClick={() => void transitionAction(action, "dismissed")} type="button">Dismiss</button>}
                        {action && (action.status === "completed" || action.status === "dismissed" || action.status === "missed") && <button className="secondary-button" onClick={() => void transitionAction(action, "open")} type="button">Reopen</button>}
                        <span className="shop-badge">{action?.status.replace("_", " ") ?? "not synced"}</span>
                      </div>
                    </div>

                    <h3>{recommendation.title}</h3>

                    <p className="daily-vehicle-line">
                      {recommendation.vehicle} · Stage{" "}
                      {recommendation.stage} ·{" "}
                      {recommendation.laborHours.toFixed(1)} labor hours
                    </p>

                    <div className="daily-task-grid">
                      <div>
                        <span>What is wrong?</span>
                        <p>{recommendation.reason}</p>
                      </div>

                      <div>
                        <span>What should happen next?</span>
                        <p>{recommendation.action}</p>
                      </div>

                      <div>
                        <span>Suggested owner</span>
                        <p>{recommendation.owner}</p>
                      </div>

                      <div>
                        <span>Blocker classification</span>
                        <p>{recommendation.blocker}</p>
                      </div>

                      <div>
                        <span>Days onsite</span>
                        <p>
                          {recommendation.daysOnSite === null
                            ? "Arrival date unavailable"
                            : `${recommendation.daysOnSite} days`}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );
}

export default DailyReport;
