import { useMemo } from "react";
import {
  useImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  evaluateAllShops,
  evaluateRepair,
} from "./engine/operationsEngine";

function riskClass(risk: string) {
  if (risk === "Low") return "good";
  if (risk === "Medium") return "warning";
  return "alert";
}

function OperationsEngineTest() {
  const importedRecord = useImportedWip();

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const shopHealth = useMemo(
    () => evaluateAllShops(repairOrders),
    [repairOrders],
  );

  const repairHealth = useMemo(
    () =>
      repairOrders
        .map(evaluateRepair)
        .sort((a, b) => {
          const difference =
            b.priorityScore - a.priorityScore;

          if (difference !== 0) return difference;

          return a.healthScore - b.healthScore;
        }),
    [repairOrders],
  );

  if (repairOrders.length === 0) {
    return (
      <section className="panel daily-empty">
        <div className="ai-mark">OPS</div>
        <h3>No imported WIP data found</h3>
        <p>Import and apply a Nexsyis WIP report first.</p>
      </section>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">OPERATIONS ENGINE V1</p>
          <h2>Health & Priority Test</h2>
          <p className="page-description">
            Validate repair and shop scoring before connecting the
            engine to Mission Control.
          </p>
        </div>
      </header>

      <section className="wip-shop-grid">
        {shopHealth.map((shop) => (
          <article className="panel" key={shop.shop}>
            <div className="wip-intelligence-header">
              <div>
                <p className="section-label">SHOP HEALTH</p>
                <h3>{shop.shop}</h3>
              </div>

              <span
                className={`status ${riskClass(
                  shop.riskLevel,
                )}`}
              >
                {shop.riskLevel}
              </span>
            </div>

            <div className="engine-health-score">
              <strong>{shop.healthScore}</strong>
              <span>/ 100</span>
            </div>

            <div className="wip-intelligence-metrics">
              <div>
                <span>Repairs</span>
                <strong>{shop.repairCount}</strong>
              </div>

              <div>
                <span>Production Holds</span>
                <strong>{shop.productionHoldCount}</strong>
              </div>

              <div>
                <span>Back Orders</span>
                <strong>{shop.backOrderedPartsCount}</strong>
              </div>

              <div>
                <span>Completed Holds</span>
                <strong>{shop.completedHoldCount}</strong>
              </div>

              <div>
                <span>Aging Repairs</span>
                <strong>{shop.agingRepairCount}</strong>
              </div>

              <div>
                <span>Critical Repairs</span>
                <strong>{shop.criticalRepairCount}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">
              PRIORITY VALIDATION
            </p>
            <h3>Highest-Priority Repairs</h3>
          </div>
        </div>

        <div className="engine-repair-list">
          {repairHealth.slice(0, 15).map((repair) => (
            <article
              className="engine-repair-row"
              key={`${repair.repairOrder.shop}-${repair.repairOrder.roNumber}`}
            >
              <div>
                <strong>
                  RO {repair.repairOrder.roNumber}
                </strong>
                <span>{repair.repairOrder.vehicle}</span>
              </div>

              <div>
                <span>Stage</span>
                <strong>{repair.stageName}</strong>
              </div>

              <div>
                <span>Health</span>
                <strong>{repair.healthScore}</strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>{repair.priorityScore}</strong>
              </div>

              <div>
                <span>Risk</span>
                <strong>{repair.riskLevel}</strong>
              </div>

              <div>
                <span>Next action</span>
                <strong>{repair.nextAction}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default OperationsEngineTest;
