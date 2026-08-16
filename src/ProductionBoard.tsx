import { useMemo, useState } from "react";
import type { RiskLevel } from "./engine/operationsEngine";
import {
  buildIntelligenceSnapshot,
  type RepairIntelligence,
} from "./engine/intelligence";
import {
  useImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  isBackOrderedParts,
  isCompletedHold,
  isProductionHold,
} from "./services/stageDictionary";

type BoardColumn = {
  id: string;
  title: string;
  stages: string[];
};

const boardColumns: BoardColumn[] = [
  { id: "arrival", title: "Arrival", stages: ["ARRIVAL"] },
  { id: "blueprint", title: "Blueprint", stages: ["BP"] },
  { id: "parts-ordered", title: "Parts Ordered", stages: ["PO"] },
  { id: "backordered", title: "Back Ordered Parts", stages: ["BOP"] },
  { id: "hold", title: "Production Hold", stages: ["HOLD", "HLD"] },
  { id: "body", title: "Body", stages: ["BODY"] },
  { id: "paint", title: "Paint", stages: ["PNT"] },
  { id: "reassembly", title: "Reassembly", stages: ["RSSMB"] },
  {
    id: "completed-hold",
    title: "Completed / Delivery Hold",
    stages: ["C/HLD"],
  },
];

function normalizeStage(stage: string) {
  return stage.trim().toUpperCase();
}

function riskClass(risk: RiskLevel) {
  if (risk === "Low") return "good";
  if (risk === "Medium") return "warning";
  return "alert";
}

function stageClass(stage: string) {
  if (isProductionHold(stage)) return "production-card-hold";
  if (isBackOrderedParts(stage)) return "production-card-bop";
  if (isCompletedHold(stage)) return "production-card-completed";
  return "";
}

function sortRepairs(
  repairA: RepairIntelligence,
  repairB: RepairIntelligence,
) {
  const priorityDifference =
    repairB.health.priorityScore -
    repairA.health.priorityScore;

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return (
    repairA.health.healthScore -
    repairB.health.healthScore
  );
}

function ProductionBoard() {
  const importedRecord = useImportedWip();

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

  const [selectedRepair, setSelectedRepair] =
    useState<RepairIntelligence | null>(null);

  const visibleRepairs = useMemo(
    () =>
      selectedShop === "All Locations"
        ? intelligence.repairs
        : intelligence.repairs.filter(
            (repair) =>
              repair.repairOrder.shop === selectedShop,
          ),
    [intelligence.repairs, selectedShop],
  );

  const mappedStages = useMemo(
    () =>
      new Set(
        boardColumns.flatMap(
          (column) => column.stages,
        ),
      ),
    [],
  );

  const unmappedRepairs = useMemo(
    () =>
      visibleRepairs
        .filter(
          (repair) =>
            !mappedStages.has(
              normalizeStage(
                repair.repairOrder.stage,
              ),
            ),
        )
        .sort(sortRepairs),
    [mappedStages, visibleRepairs],
  );

  function getRepairsForColumn(
    column: BoardColumn,
  ) {
    return visibleRepairs
      .filter((repair) =>
        column.stages.includes(
          normalizeStage(
            repair.repairOrder.stage,
          ),
        ),
      )
      .sort(sortRepairs);
  }

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              INTELLIGENCE CORE · PRODUCTION
            </p>
            <h2>Production Board</h2>
            <p className="page-description">
              Track imported repair orders by production stage.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">PB</div>
          <h3>No imported WIP report found</h3>
          <p>
            Open Import Center, upload a WIP report,
            assign the store, and click Apply Import.
          </p>
        </section>
      </>
    );
  }

  const activeRepairs = visibleRepairs.filter(
    (repair) => repair.isActiveProduction,
  );

  const selectedAlerts =
    selectedShop === "All Locations"
      ? intelligence.alerts
      : intelligence.alerts.filter(
          (alert) => alert.shop === selectedShop,
        );

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            INTELLIGENCE CORE · PRODUCTION WORKFLOW
          </p>

          <h2>Production Board</h2>

          <p className="page-description">
            Review every repair by stage, health, risk,
            priority, blocker, and recommended next action
            from one shared intelligence source.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setSelectedRepair(null);
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
        </div>
      </header>

      <section className="production-board-summary">
        <article className="metric-card">
          <span>Active Repairs</span>
          <strong className="viz-stat-value">
            {activeRepairs.length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Production Holds</span>
          <strong className="viz-stat-value">
            {
              visibleRepairs.filter(
                (repair) =>
                  repair.isProductionHold,
              ).length
            }
          </strong>
        </article>

        <article className="metric-card">
          <span>Back Ordered Parts</span>
          <strong className="viz-stat-value">
            {
              visibleRepairs.filter(
                (repair) =>
                  repair.isBackOrderedParts,
              ).length
            }
          </strong>
        </article>

        <article className="metric-card">
          <span>Intelligence Alerts</span>
          <strong className="viz-stat-value">
            {selectedAlerts.length}
          </strong>
        </article>
      </section>

      <section className="production-board-wrapper">
        <div className="production-board">
          {boardColumns.map((column) => {
            const repairs =
              getRepairsForColumn(column);

            return (
              <section
                className="production-column"
                key={column.id}
              >
                <div className="production-column-header">
                  <div>
                    <h3>{column.title}</h3>
                    <span>
                      {repairs.length}{" "}
                      {repairs.length === 1
                        ? "repair"
                        : "repairs"}
                    </span>
                  </div>

                  <strong>
                    {repairs
                      .reduce(
                        (total, repair) =>
                          total +
                          repair.repairOrder
                            .laborHours,
                        0,
                      )
                      .toFixed(1)}{" "}
                    hrs
                  </strong>
                </div>

                <div className="production-column-cards">
                  {repairs.length === 0 ? (
                    <div className="production-column-empty">
                      No repairs
                    </div>
                  ) : (
                    repairs.map((repair, index) => (
                      <button
                        className={`production-repair-card ${stageClass(
                          repair.repairOrder.stage,
                        )}`}
                        key={`${repair.repairOrder.shop}-${repair.repairOrder.roNumber}-${index}`}
                        onClick={() =>
                          setSelectedRepair(repair)
                        }
                        type="button"
                      >
                        <div className="production-card-heading">
                          <div>
                            <strong>
                              RO{" "}
                              {
                                repair.repairOrder
                                  .roNumber
                              }
                            </strong>

                            <span>
                              {repair.repairOrder.shop}
                            </span>
                          </div>

                          <span
                            className={`status ${riskClass(
                              repair.health.riskLevel,
                            )}`}
                          >
                            {repair.health.riskLevel}
                          </span>
                        </div>

                        <h4>
                          {repair.repairOrder.vehicle}
                        </h4>

                        <p>
                          {repair.repairOrder.customer}
                        </p>

                        <div className="production-card-metrics">
                          <div>
                            <span>Labor</span>
                            <strong>
                              {repair.repairOrder.laborHours.toFixed(
                                1,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Days</span>
                            <strong>
                              {repair.health.daysOnSite ??
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Health</span>
                            <strong>
                              {repair.health.healthScore}
                            </strong>
                          </div>

                          <div>
                            <span>Priority</span>
                            <strong>
                              {repair.health.priorityScore}
                            </strong>
                          </div>
                        </div>

                        <div className="production-card-ownership">
                          <span>
                            Tech:{" "}
                            {
                              repair.repairOrder
                                .technician
                            }
                          </span>

                          <span>
                            Est:{" "}
                            {
                              repair.repairOrder
                                .estimator
                            }
                          </span>
                        </div>

                        <div className="production-core-action">
                          <span>Next action</span>
                          <p>
                            {repair.health.nextAction}
                          </p>
                        </div>

                        <small>
                          {repair.health.stageName}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              </section>
            );
          })}

          {unmappedRepairs.length > 0 && (
            <section className="production-column">
              <div className="production-column-header">
                <div>
                  <h3>Unmapped Stage</h3>
                  <span>
                    {unmappedRepairs.length} repairs
                  </span>
                </div>
              </div>

              <div className="production-column-cards">
                {unmappedRepairs.map(
                  (repair, index) => (
                    <button
                      className="production-repair-card production-card-unmapped"
                      key={`${repair.repairOrder.roNumber}-${index}`}
                      onClick={() =>
                        setSelectedRepair(repair)
                      }
                      type="button"
                    >
                      <div className="production-card-heading">
                        <strong>
                          RO{" "}
                          {repair.repairOrder.roNumber}
                        </strong>

                        <span
                          className={`status ${riskClass(
                            repair.health.riskLevel,
                          )}`}
                        >
                          {repair.health.riskLevel}
                        </span>
                      </div>

                      <h4>
                        {repair.repairOrder.vehicle}
                      </h4>

                      <p>
                        Imported stage:{" "}
                        {repair.repairOrder.stage}
                      </p>

                      <small>
                        Add this stage to the operations
                        dictionary.
                      </small>
                    </button>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </section>

      {selectedRepair && (
        <section className="panel production-detail-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                REPAIR INTELLIGENCE DETAIL
              </p>

              <h3>
                RO{" "}
                {selectedRepair.repairOrder.roNumber} —{" "}
                {selectedRepair.repairOrder.vehicle}
              </h3>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setSelectedRepair(null)
              }
              type="button"
            >
              Close
            </button>
          </div>

          <div className="production-detail-grid">
            <div>
              <span>Shop</span>
              <strong>
                {selectedRepair.repairOrder.shop}
              </strong>
            </div>

            <div>
              <span>Customer</span>
              <strong>
                {
                  selectedRepair.repairOrder
                    .customer
                }
              </strong>
            </div>

            <div>
              <span>Insurance</span>
              <strong>
                {
                  selectedRepair.repairOrder
                    .insurance
                }
              </strong>
            </div>

            <div>
              <span>Current Stage</span>
              <strong>
                {selectedRepair.health.stageName}
              </strong>
            </div>

            <div>
              <span>Technician</span>
              <strong>
                {
                  selectedRepair.repairOrder
                    .technician
                }
              </strong>
            </div>

            <div>
              <span>Estimator</span>
              <strong>
                {
                  selectedRepair.repairOrder
                    .estimator
                }
              </strong>
            </div>

            <div>
              <span>Labor Hours</span>
              <strong>
                {selectedRepair.repairOrder.laborHours.toFixed(
                  1,
                )}
              </strong>
            </div>

            <div>
              <span>Pre-Tax Value</span>
              <strong>
                {selectedRepair.repairOrder.preTaxTotal.toLocaleString(
                  "en-US",
                  {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  },
                )}
              </strong>
            </div>

            <div>
              <span>Days Onsite</span>
              <strong>
                {selectedRepair.health.daysOnSite ??
                  "Unavailable"}
              </strong>
            </div>

            <div>
              <span>Health Score</span>
              <strong>
                {selectedRepair.health.healthScore} / 100
              </strong>
            </div>

            <div>
              <span>Priority Score</span>
              <strong>
                {selectedRepair.health.priorityScore} / 100
              </strong>
            </div>

            <div>
              <span>Blocker</span>
              <strong>
                {selectedRepair.health.blocker}
              </strong>
            </div>
          </div>

          <div className="production-next-action">
            <span>Recommended next action</span>
            <p>
              {selectedRepair.health.nextAction}
            </p>
            <small>
              Suggested owner:{" "}
              {selectedRepair.health.suggestedOwner}
            </small>
          </div>

          <div className="production-intelligence-flags">
            <span>
              Active production:{" "}
              {selectedRepair.isActiveProduction
                ? "Yes"
                : "No"}
            </span>
            <span>
              Back ordered:{" "}
              {selectedRepair.isBackOrderedParts
                ? "Yes"
                : "No"}
            </span>
            <span>
              Production hold:{" "}
              {selectedRepair.isProductionHold
                ? "Yes"
                : "No"}
            </span>
            <span>
              Management attention:{" "}
              {selectedRepair.needsManagementAttention
                ? "Yes"
                : "No"}
            </span>
          </div>

          {selectedRepair.health.healthReasons.length >
            0 && (
            <div className="production-score-reasons">
              <h4>Health score factors</h4>

              {selectedRepair.health.healthReasons.map(
                (reason, index) => (
                  <div
                    key={`${reason.label}-${index}`}
                  >
                    <strong>
                      {reason.points}
                    </strong>

                    <p>
                      <span>{reason.label}</span>
                      {reason.explanation}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default ProductionBoard;
