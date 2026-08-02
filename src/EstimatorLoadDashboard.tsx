import { useMemo, useState } from "react";
import { buildIntelligenceSnapshot } from "./engine/intelligence";
import { buildEstimatorLoadSnapshot } from "./engine/estimator/estimatorEngine";
import type {
  EstimatorLoad,
  EstimatorLoadStatus,
} from "./engine/estimator/estimatorTypes";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function statusClass(status: EstimatorLoadStatus) {
  if (status === "Light" || status === "Balanced") {
    return "good";
  }

  if (status === "Heavy") {
    return "warning";
  }

  return "alert";
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function EstimatorLoadDashboard() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const estimatorLoad = useMemo(
    () => buildEstimatorLoadSnapshot(intelligence),
    [intelligence],
  );

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const [selectedEstimator, setSelectedEstimator] =
    useState<EstimatorLoad | null>(null);

  const visibleEstimators =
    selectedShop === "All Locations"
      ? estimatorLoad.estimators
      : estimatorLoad.estimators.filter(
          (estimator) =>
            estimator.shop === selectedShop,
        );

  const visibleOpenRepairs =
    visibleEstimators.reduce(
      (total, estimator) =>
        total + estimator.openRepairCount,
      0,
    );

  const visibleOpenValue =
    visibleEstimators.reduce(
      (total, estimator) =>
        total + estimator.openRepairValue,
      0,
    );

  const visibleHeavy =
    visibleEstimators.filter(
      (estimator) =>
        estimator.status === "Heavy" ||
        estimator.status === "Overloaded",
    ).length;

  const visibleUnassigned =
    visibleEstimators
      .filter(
        (estimator) =>
          estimator.status === "Unassigned",
      )
      .reduce(
        (total, estimator) =>
          total + estimator.openRepairCount,
        0,
      );

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              WORKFORCE INTELLIGENCE
            </p>
            <h2>Estimator Load</h2>
            <p className="page-description">
              Compare estimator file workload using the fields
              available in the imported WIP report.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">EL</div>
          <h3>No imported WIP data found</h3>
          <p>
            Apply a WIP import before calculating estimator
            workload.
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
            INTELLIGENCE CORE · ESTIMATOR WORKLOAD
          </p>
          <h2>Estimator Load</h2>
          <p className="page-description">
            Balance open files, labor exposure, sales value,
            aging, high-risk repairs, production holds, and
            back-ordered parts across the estimator team.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setSelectedEstimator(null);
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
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Open Repair Files</p>
          <strong>{visibleOpenRepairs}</strong>
          <small>All estimator-owned repair orders</small>
        </article>

        <article className="card">
          <p>Open Repair Value</p>
          <strong>{formatCurrency(visibleOpenValue)}</strong>
          <small>Pre-tax value assigned to visible estimators</small>
        </article>

        <article className="card">
          <p>Heavy / Overloaded</p>
          <strong>{visibleHeavy}</strong>
          <small>Above the shop estimator-team average</small>
        </article>

        <article className="card">
          <p>Unassigned Files</p>
          <strong>{visibleUnassigned}</strong>
          <small>Repairs without estimator ownership</small>
        </article>
      </section>

      <section className="estimator-load-explainer panel">
        <span>How workload balance is calculated</span>
        <p>
          The score combines open file count, active labor hours,
          high-risk repairs, production holds, back-ordered parts,
          and repairs onsite 20 or more days. Each estimator is
          compared with the average for their own shop. It is a
          workload-balance indicator, not a payroll or performance
          rating.
        </p>
      </section>

      <section className="estimator-load-grid">
        {visibleEstimators.map((estimator) => (
          <article
            className="panel estimator-load-card"
            key={estimator.id}
          >
            <div className="estimator-load-heading">
              <div>
                <p className="section-label">
                  {estimator.shop}
                </p>
                <h3>{estimator.estimator}</h3>
              </div>

              <span
                className={`status ${statusClass(
                  estimator.status,
                )}`}
              >
                {estimator.status}
              </span>
            </div>

            <div className="estimator-workload-index">
              <div>
                <span>Workload vs. shop average</span>
                <strong>
                  {estimator.status === "Unassigned"
                    ? "—"
                    : `${estimator.workloadIndexPercent.toFixed(
                        0,
                      )}%`}
                </strong>
              </div>

              <div className="estimator-workload-track">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      estimator.workloadIndexPercent,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="estimator-load-metrics">
              <div>
                <span>Open Files</span>
                <strong>{estimator.openRepairCount}</strong>
              </div>

              <div>
                <span>Active Repairs</span>
                <strong>{estimator.activeRepairCount}</strong>
              </div>

              <div>
                <span>Labor Exposure</span>
                <strong>
                  {estimator.totalLaborHours.toFixed(1)} hrs
                </strong>
              </div>

              <div>
                <span>Open Value</span>
                <strong>
                  {formatCurrency(estimator.openRepairValue)}
                </strong>
              </div>

              <div>
                <span>High / Critical</span>
                <strong>
                  {estimator.highRiskRepairCount} /{" "}
                  {estimator.criticalRepairCount}
                </strong>
              </div>

              <div>
                <span>Holds / BOP / Aging</span>
                <strong>
                  {estimator.productionHoldCount} /{" "}
                  {estimator.backOrderedPartsCount} /{" "}
                  {estimator.agingRepairCount}
                </strong>
              </div>
            </div>

            <div className="wip-recommendation">
              <span>Estimator recommendation</span>
              <p>{estimator.recommendation}</p>
            </div>

            <button
              className="secondary-button estimator-detail-button"
              onClick={() =>
                setSelectedEstimator(estimator)
              }
              type="button"
            >
              View Assigned Repair Files
            </button>
          </article>
        ))}
      </section>

      {selectedEstimator && (
        <section className="panel estimator-repair-detail">
          <div className="panel-header">
            <div>
              <p className="section-label">
                ESTIMATOR FILE DETAIL
              </p>
              <h3>
                {selectedEstimator.estimator} ·{" "}
                {selectedEstimator.shop}
              </h3>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setSelectedEstimator(null)
              }
              type="button"
            >
              Close
            </button>
          </div>

          <div className="estimator-repair-list">
            {selectedEstimator.repairs.map((repair) => (
              <article
                key={`${repair.shop}-${repair.roNumber}`}
              >
                <div>
                  <strong>RO {repair.roNumber}</strong>
                  <span>{repair.vehicle}</span>
                </div>

                <div>
                  <span>Stage</span>
                  <strong>{repair.stage}</strong>
                </div>

                <div>
                  <span>Days</span>
                  <strong>
                    {repair.daysOnSite ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Labor</span>
                  <strong>
                    {repair.laborHours.toFixed(1)} hrs
                  </strong>
                </div>

                <div>
                  <span>Value</span>
                  <strong>
                    {formatCurrency(repair.preTaxTotal)}
                  </strong>
                </div>

                <div>
                  <span>Health / Priority</span>
                  <strong>
                    {repair.healthScore} /{" "}
                    {repair.priorityScore}
                  </strong>
                </div>

                <div>
                  <span>Risk</span>
                  <strong>{repair.riskLevel}</strong>
                </div>

                <p>{repair.nextAction}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default EstimatorLoadDashboard;
