import { useMemo, useState } from "react";
import CapacityIntegrationPanel from "./CapacityIntegrationPanel";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  buildOperationalRecommendations,
  type OperationalPriority,
} from "./services/recommendationEngine";

function priorityClass(priority: OperationalPriority) {
  return priority.toLowerCase();
}

function DailyReport() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const shops = useMemo(
    () =>
      Array.from(
        new Set(repairOrders.map((order) => order.shop)),
      ).sort(),
    [repairOrders],
  );

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const [generated, setGenerated] = useState(false);

  const [completedIds, setCompletedIds] = useState<string[]>(
    [],
  );

  const recommendations = useMemo(() => {
    const applicableOrders =
      selectedShop === "All Locations"
        ? repairOrders
        : repairOrders.filter(
            (order) => order.shop === selectedShop,
          );

    return buildOperationalRecommendations(applicableOrders);
  }, [repairOrders, selectedShop]);

  const priorityTotals = useMemo(
    () => ({
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
    }),
    [recommendations],
  );

  function toggleComplete(id: string) {
    setCompletedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
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
              Generate an operating plan from imported Nexsyis
              repair-order data.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">AI</div>

          <h3>No imported WIP report found</h3>

          <p>
            Open Import Center, select the correct store, upload the
            Nexsyis WIP report, and click Apply Import.
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
            IMPORTED OPERATIONS INTELLIGENCE
          </p>

          <h2>dAIly Report</h2>

          <p className="page-description">
            Generate a repair-level playbook using the latest imported
            Nexsyis WIP report.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setGenerated(false);
              setCompletedIds([]);
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
            onClick={() => setGenerated(true)}
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
          <span>Assigned location</span>
          <strong>
            {shops.length === 1
              ? shops[0]
              : `${shops.length} locations`}
          </strong>
        </div>

        <div>
          <span>Repair orders analyzed</span>
          <strong>{repairOrders.length}</strong>
        </div>

        <div>
          <span>Imported</span>
          <strong>
            {new Date(
              importedRecord.importedAt,
            ).toLocaleString()}
          </strong>
        </div>
      </section>

      {!generated ? (
        <section className="panel daily-empty">
          <div className="ai-mark">AI</div>

          <h3>Imported data is ready</h3>

          <p>
            Generate the report to identify production holds,
            back-ordered parts, completed delivery holds, large
            blueprints, missing assignments, and aging repairs.
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
                The system identified {priorityTotals.critical} critical,
                {" "}
                {priorityTotals.high} high-priority,{" "}
                {priorityTotals.medium} medium-priority, and{" "}
                {priorityTotals.low} low-priority actions from the
                imported repair orders.
              </p>
            </article>

            <article className="panel completion-card">
              <span>Tasks completed</span>

              <strong>
                {
                  completedIds.filter((id) =>
                    recommendations.some(
                      (recommendation) =>
                        recommendation.id === id,
                    ),
                  ).length
                }{" "}
                / {recommendations.length}
              </strong>
            </article>
          </section>

          <CapacityIntegrationPanel
            compact
            repairOrders={repairOrders}
            selectedShop={selectedShop}
            title="Today's Scheduling Direction"
          />

          {recommendations.length === 0 ? (
            <section className="panel daily-empty">
              <div className="ai-mark">AI</div>

              <h3>No recommendation rules were triggered</h3>

              <p>
                The imported report contains no repairs currently
                matching the active blocker, aging, assignment, or
                large-blueprint rules.
              </p>
            </section>
          ) : (
            <section className="daily-task-list">
              {recommendations.map((recommendation) => {
                const completed = completedIds.includes(
                  recommendation.id,
                );

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

                      <label className="complete-control">
                        <input
                          checked={completed}
                          onChange={() =>
                            toggleComplete(recommendation.id)
                          }
                          type="checkbox"
                        />

                        Complete
                      </label>
                    </div>

                    <h3>{recommendation.title}</h3>

                    <p className="daily-vehicle-line">
                      {recommendation.vehicle} · Stage{" "}
                      {recommendation.stage} ·{" "}
                      {recommendation.laborHours.toFixed(1)} labor hours
                    </p>

                    <div className="daily-task-grid">
                      <div>
                        <span>Recommended action</span>
                        <p>{recommendation.action}</p>
                      </div>

                      <div>
                        <span>Why this was generated</span>
                        <p>{recommendation.reason}</p>
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
