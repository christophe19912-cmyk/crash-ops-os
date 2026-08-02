import { useMemo } from "react";
import {
  buildIntelligenceSnapshot,
  type RepairIntelligence,
} from "./engine/intelligence/intelligenceEngine";

import type { RiskLevel } from "./engine/operationsEngine";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function riskClass(risk: RiskLevel) {
  if (risk === "Low") return "good";
  if (risk === "Medium") return "warning";
  return "alert";
}

function alertClass(severity: string) {
  if (severity === "Info") return "good";
  if (severity === "Warning") return "warning";
  return "alert";
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function MissionControl() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">MISSION CONTROL</p>
            <h2>Regional Operations Command Center</h2>
            <p className="page-description">
              Review shop health, urgent risks, capacity, and today’s
              highest-priority operating actions.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">MC</div>
          <h3>No imported WIP data found</h3>
          <p>
            Open Import Center, upload the latest WIP report, assign it
            to the correct location, and apply the import.
          </p>
        </section>
      </>
    );
  }

  const {
    summary,
    shops,
    repairs,
    alerts,
    recommendations,
  } = intelligence;

  const regionalHealth =
    shops.length > 0
      ? Math.round(
          shops.reduce(
            (total, shop) => total + shop.health.healthScore,
            0,
          ) / shops.length,
        )
      : 100;

  const regionalRisk: RiskLevel =
    shops.some((shop) => shop.overallRisk === "Critical")
      ? "Critical"
      : shops.some((shop) => shop.overallRisk === "High")
        ? "High"
        : shops.some((shop) => shop.overallRisk === "Medium")
          ? "Medium"
          : "Low";

  const highRiskRepairs = repairs.filter(
    (repair) =>
      repair.health.riskLevel === "Critical" ||
      repair.health.riskLevel === "High",
  );

  const riskLaborHours = highRiskRepairs.reduce(
    (total, repair) =>
      total + repair.repairOrder.laborHours,
    0,
  );

  const riskSalesValue = highRiskRepairs.reduce(
    (total, repair) =>
      total + repair.repairOrder.preTaxTotal,
    0,
  );

  const topRepairs: RepairIntelligence[] = repairs
    .slice()
    .sort((a, b) => {
      const priorityDifference =
        b.health.priorityScore - a.health.priorityScore;

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return a.health.healthScore - b.health.healthScore;
    })
    .slice(0, 5);

  const topAlerts = alerts.slice(0, 5);
  const topRecommendations = recommendations.slice(0, 5);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            CRASH OPS INTELLIGENCE · MISSION CONTROL
          </p>

          <h2>Regional Operations Command Center</h2>

          <p className="page-description">
            One shared intelligence snapshot now powers health, risk,
            capacity, alerts, and operating priorities.
          </p>
        </div>

        <div className="mission-source">
          <span>Data source</span>
          <strong>{importedRecord.fileName}</strong>
          <small>
            Snapshot generated{" "}
            {new Date(
              intelligence.generatedAt,
            ).toLocaleString()}
          </small>
        </div>
      </header>

      <section className="mission-health-grid">
        <article className="panel mission-health-card">
          <div>
            <p className="section-label">REGIONAL HEALTH</p>

            <div className="mission-health-score">
              <strong>{regionalHealth}</strong>
              <span>/ 100</span>
            </div>

            <span
              className={`status ${riskClass(regionalRisk)}`}
            >
              {regionalRisk} Risk
            </span>
          </div>

          <p>
            Calculated from the shared Intelligence Core using repair
            health, shop risk, blockers, aging, delivery closeout, and
            capacity position.
          </p>
        </article>

        <article className="card">
          <p>Active Repairs</p>
          <strong>{summary.activeRepairCount}</strong>
          <small>
            {summary.completedHoldCount} completed holds excluded
          </small>
        </article>

        <article className="card">
          <p>Active Labor Hours</p>
          <strong>
            {summary.activeLaborHours.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
          <small>
            {riskLaborHours.toFixed(1)} hours tied to high risk
          </small>
        </article>

        <article className="card">
          <p>Open Repair Value</p>
          <strong>{formatCurrency(summary.openRepairValue)}</strong>
          <small>
            {formatCurrency(riskSalesValue)} tied to high risk
          </small>
        </article>
      </section>

      <section className="mission-alert-grid">
        <article className="panel mission-alert-card">
          <span>Critical Repairs</span>
          <strong>{summary.criticalRepairCount}</strong>
          <p>Immediate management intervention recommended.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>High-Risk Repairs</span>
          <strong>{summary.highRiskRepairCount}</strong>
          <p>Require review during today’s WIP walk.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Production Holds</span>
          <strong>{summary.productionHoldCount}</strong>
          <p>Active repairs stopped by unresolved blockers.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Back-Ordered Parts</span>
          <strong>{summary.backOrderedPartsCount}</strong>
          <p>Repairs requiring sourcing or ETA escalation.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Recommended Weekly Drops</span>
          <strong>{summary.recommendedWeeklyDrops}</strong>
          <p>Combined capacity-guided intake across all shops.</p>
        </article>
      </section>

      <section className="mission-intelligence-alerts panel">
        <div className="panel-header">
          <div>
            <p className="section-label">
              INTELLIGENCE CORE ALERTS
            </p>
            <h3>Highest-Priority Operating Conditions</h3>
          </div>
        </div>

        <div className="mission-intelligence-alert-list">
          {topAlerts.length === 0 ? (
            <p>No intelligence alerts were generated.</p>
          ) : (
            topAlerts.map((alert) => (
              <article
                className="mission-intelligence-alert"
                key={alert.id}
              >
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

      <section className="mission-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                TODAY’S TOP FIVE REPAIRS
              </p>
              <h3>Highest-Priority Repair Actions</h3>
            </div>
          </div>

          <div className="mission-priority-list">
            {topRepairs.map((repair, index) => (
              <article
                className="mission-priority-item"
                key={`${repair.repairOrder.shop}-${repair.repairOrder.roNumber}`}
              >
                <div className="mission-priority-number">
                  {index + 1}
                </div>

                <div className="mission-priority-main">
                  <div className="mission-priority-heading">
                    <div>
                      <strong>
                        RO {repair.repairOrder.roNumber}
                      </strong>
                      <span>{repair.repairOrder.vehicle}</span>
                    </div>

                    <span
                      className={`status ${riskClass(
                        repair.health.riskLevel,
                      )}`}
                    >
                      {repair.health.riskLevel}
                    </span>
                  </div>

                  <p>{repair.health.nextAction}</p>

                  <div className="mission-priority-meta">
                    <span>{repair.repairOrder.shop}</span>
                    <span>{repair.health.stageName}</span>
                    <span>
                      {repair.health.daysOnSite === null
                        ? "Age unavailable"
                        : `${repair.health.daysOnSite} days onsite`}
                    </span>
                    <span>
                      {repair.repairOrder.laborHours.toFixed(1)} hrs
                    </span>
                  </div>

                  <small>
                    Owner: {repair.health.suggestedOwner} · Health{" "}
                    {repair.health.healthScore} · Priority{" "}
                    {repair.health.priorityScore}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">SHOP INTELLIGENCE</p>
              <h3>Location Ranking</h3>
            </div>
          </div>

          <div className="mission-shop-list">
            {shops.map((shop) => (
              <article
                className="mission-shop-item"
                key={shop.shop}
              >
                <div>
                  <strong>{shop.shop}</strong>
                  <span>
                    {shop.activeRepairCount} active repairs ·{" "}
                    {shop.activeLaborHours.toFixed(1)} hours
                  </span>
                </div>

                <div className="mission-shop-score">
                  <strong>{shop.health.healthScore}</strong>

                  <span
                    className={`status ${riskClass(
                      shop.overallRisk,
                    )}`}
                  >
                    {shop.overallRisk}
                  </span>
                </div>

                <div className="mission-shop-flags">
                  <span>{shop.capacity.status}</span>
                  <span>
                    {shop.capacity.weeksToClear} weeks
                  </span>
                  <span>
                    {shop.health.productionHoldCount} holds
                  </span>
                  <span>
                    {shop.health.backOrderedPartsCount} BOP
                  </span>
                  <span>
                    {shop.capacityPlan.recommendedWeeklyDrops} drops
                  </span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      {topRecommendations.length > 0 && (
        <section className="panel mission-core-recommendations">
          <div className="panel-header">
            <div>
              <p className="section-label">
                SHARED RECOMMENDATION QUEUE
              </p>
              <h3>Intelligence Core Action Feed</h3>
            </div>
          </div>

          <div className="mission-core-recommendation-list">
            {topRecommendations.map((recommendation) => (
              <article key={recommendation.id}>
                <div>
                  <strong>
                    RO {recommendation.roNumber} ·{" "}
                    {recommendation.shop}
                  </strong>
                  <span>{recommendation.title}</span>
                </div>

                <p>{recommendation.action}</p>

                <small>
                  {recommendation.priority} · Owner:{" "}
                  {recommendation.owner}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default MissionControl;
