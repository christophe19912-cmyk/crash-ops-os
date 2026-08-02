import { useMemo } from "react";
import CapacityIntegrationPanel from "./CapacityIntegrationPanel";
import {
  evaluateAllShops,
  evaluateRepair,
  type RepairHealth,
  type RiskLevel,
} from "./engine/operationsEngine";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  isBackOrderedParts,
  isCompletedHold,
  isProductionHold,
} from "./services/stageDictionary";

function riskClass(risk: RiskLevel) {
  if (risk === "Low") return "good";
  if (risk === "Medium") return "warning";
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

  const shopHealth = useMemo(
    () => evaluateAllShops(repairOrders),
    [repairOrders],
  );

  const evaluatedRepairs = useMemo(
    () =>
      repairOrders
        .map(evaluateRepair)
        .sort((a, b) => {
          const priorityDifference =
            b.priorityScore - a.priorityScore;

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          return a.healthScore - b.healthScore;
        }),
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
              Review shop health, urgent risks, and today’s highest
              priority operating actions.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">MC</div>
          <h3>No imported WIP data found</h3>
          <p>
            Open Import Center, upload the latest Nexsyis WIP report,
            assign it to the correct location, and apply the import.
          </p>
        </section>
      </>
    );
  }

  const totalLaborHours = repairOrders.reduce(
    (total, order) => total + order.laborHours,
    0,
  );

  const totalSalesValue = repairOrders.reduce(
    (total, order) => total + order.preTaxTotal,
    0,
  );

  const criticalRepairs = evaluatedRepairs.filter(
    (repair) => repair.riskLevel === "Critical",
  );

  const highRiskRepairs = evaluatedRepairs.filter(
    (repair) => repair.riskLevel === "High",
  );

  const productionHolds = repairOrders.filter((order) =>
    isProductionHold(order.stage),
  );

  const backOrderedParts = repairOrders.filter((order) =>
    isBackOrderedParts(order.stage),
  );

  const completedHolds = repairOrders.filter((order) =>
    isCompletedHold(order.stage),
  );

  const regionalHealth =
    shopHealth.length > 0
      ? Math.round(
          shopHealth.reduce(
            (total, shop) => total + shop.healthScore,
            0,
          ) / shopHealth.length,
        )
      : 100;

  const regionalRisk: RiskLevel =
    regionalHealth <= 39
      ? "Critical"
      : regionalHealth <= 59
        ? "High"
        : regionalHealth <= 79
          ? "Medium"
          : "Low";

  const highestPriorityRepairs = evaluatedRepairs.slice(0, 5);

  const riskLaborHours = evaluatedRepairs
    .filter(
      (repair) =>
        repair.riskLevel === "Critical" ||
        repair.riskLevel === "High",
    )
    .reduce(
      (total, repair) =>
        total + repair.repairOrder.laborHours,
      0,
    );

  const riskSalesValue = evaluatedRepairs
    .filter(
      (repair) =>
        repair.riskLevel === "Critical" ||
        repair.riskLevel === "High",
    )
    .reduce(
      (total, repair) =>
        total + repair.repairOrder.preTaxTotal,
      0,
    );

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            BODY BY COCHRAN · MISSION CONTROL
          </p>

          <h2>Regional Operations Command Center</h2>

          <p className="page-description">
            Know which repairs, blockers, and operating actions require
            attention first today.
          </p>
        </div>

        <div className="mission-source">
          <span>Data source</span>
          <strong>{importedRecord.fileName}</strong>
          <small>
            Imported{" "}
            {new Date(
              importedRecord.importedAt,
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
            Calculated from repair health, shop risk, blockers, aging,
            assignments, and delivery closeout conditions.
          </p>
        </article>

        <article className="card">
          <p>Vehicles On Site</p>
          <strong>{repairOrders.length}</strong>
          <small>Imported active and completed onsite repairs</small>
        </article>

        <article className="card">
          <p>Labor Hours In Process</p>
          <strong>
            {totalLaborHours.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
          <small>{riskLaborHours.toFixed(1)} hours tied to high risk</small>
        </article>

        <article className="card">
          <p>Open Repair Value</p>
          <strong>{formatCurrency(totalSalesValue)}</strong>
          <small>
            {formatCurrency(riskSalesValue)} tied to high risk
          </small>
        </article>
      </section>

      <section className="mission-alert-grid">
        <article className="panel mission-alert-card">
          <span>Critical Repairs</span>
          <strong>{criticalRepairs.length}</strong>
          <p>Immediate management intervention recommended.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>High-Risk Repairs</span>
          <strong>{highRiskRepairs.length}</strong>
          <p>Require review during today’s WIP walk.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Production Holds</span>
          <strong>{productionHolds.length}</strong>
          <p>Repairs stopped by unresolved production blockers.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Back-Ordered Parts</span>
          <strong>{backOrderedParts.length}</strong>
          <p>Repairs requiring sourcing or ETA escalation.</p>
        </article>

        <article className="panel mission-alert-card">
          <span>Completed / Delivery Hold</span>
          <strong>{completedHolds.length}</strong>
          <p>Completed vehicles awaiting final release or pickup.</p>
        </article>
      </section>

      <CapacityIntegrationPanel
        repairOrders={repairOrders}
        title="Regional Capacity Snapshot"
      />

      <section className="mission-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                TODAY’S TOP FIVE ACTIONS
              </p>

              <h3>Highest-Priority Repairs</h3>
            </div>
          </div>

          <div className="mission-priority-list">
            {highestPriorityRepairs.map(
              (repair: RepairHealth, index) => (
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

                        <span>
                          {repair.repairOrder.vehicle}
                        </span>
                      </div>

                      <span
                        className={`status ${riskClass(
                          repair.riskLevel,
                        )}`}
                      >
                        {repair.riskLevel}
                      </span>
                    </div>

                    <p>{repair.nextAction}</p>

                    <div className="mission-priority-meta">
                      <span>{repair.repairOrder.shop}</span>
                      <span>{repair.stageName}</span>
                      <span>
                        {repair.daysOnSite === null
                          ? "Age unavailable"
                          : `${repair.daysOnSite} days onsite`}
                      </span>
                      <span>
                        {repair.repairOrder.laborHours.toFixed(1)} hrs
                      </span>
                    </div>

                    <small>
                      Owner: {repair.suggestedOwner} · Health{" "}
                      {repair.healthScore} · Priority{" "}
                      {repair.priorityScore}
                    </small>
                  </div>
                </article>
              ),
            )}
          </div>
        </article>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">SHOP HEALTH</p>
              <h3>Location Ranking</h3>
            </div>
          </div>

          <div className="mission-shop-list">
            {shopHealth.map((shop) => (
              <article
                className="mission-shop-item"
                key={shop.shop}
              >
                <div>
                  <strong>{shop.shop}</strong>
                  <span>
                    {shop.repairCount} repairs ·{" "}
                    {shop.laborHours.toFixed(1)} hours
                  </span>
                </div>

                <div className="mission-shop-score">
                  <strong>{shop.healthScore}</strong>

                  <span
                    className={`status ${riskClass(
                      shop.riskLevel,
                    )}`}
                  >
                    {shop.riskLevel}
                  </span>
                </div>

                <div className="mission-shop-flags">
                  <span>
                    {shop.productionHoldCount} holds
                  </span>
                  <span>
                    {shop.backOrderedPartsCount} BOP
                  </span>
                  <span>
                    {shop.completedHoldCount} complete
                  </span>
                  <span>
                    {shop.agingRepairCount} aging
                  </span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}

export default MissionControl;
