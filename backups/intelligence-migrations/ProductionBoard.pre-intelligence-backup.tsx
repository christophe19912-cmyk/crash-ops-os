import { useMemo, useState } from "react";
import {
  evaluateRepair,
  type RepairHealth,
  type RiskLevel,
} from "./engine/operationsEngine";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import {
  getStageDefinition,
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
  {
    id: "arrival",
    title: "Arrival",
    stages: ["ARRIVAL"],
  },
  {
    id: "blueprint",
    title: "Blueprint",
    stages: ["BP"],
  },
  {
    id: "parts-ordered",
    title: "Parts Ordered",
    stages: ["PO"],
  },
  {
    id: "backordered",
    title: "Back Ordered Parts",
    stages: ["BOP"],
  },
  {
    id: "hold",
    title: "Production Hold",
    stages: ["HOLD", "HLD"],
  },
  {
    id: "body",
    title: "Body",
    stages: ["BODY"],
  },
  {
    id: "paint",
    title: "Paint",
    stages: ["PNT"],
  },
  {
    id: "reassembly",
    title: "Reassembly",
    stages: ["RSSMB"],
  },
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
  if (isCompletedHold(stage)) {
    return "production-card-completed";
  }

  return "";
}

function sortRepairs(
  repairA: RepairHealth,
  repairB: RepairHealth,
) {
  const priorityDifference =
    repairB.priorityScore - repairA.priorityScore;

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return repairA.healthScore - repairB.healthScore;
}

function ProductionBoard() {
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

  const [selectedRepair, setSelectedRepair] =
    useState<RepairHealth | null>(null);

  const visibleOrders = useMemo(
    () =>
      selectedShop === "All Locations"
        ? repairOrders
        : repairOrders.filter(
            (order) => order.shop === selectedShop,
          ),
    [repairOrders, selectedShop],
  );

  const evaluatedRepairs = useMemo(
    () => visibleOrders.map(evaluateRepair),
    [visibleOrders],
  );

  const unmappedRepairs = useMemo(() => {
    const mappedStages = new Set(
      boardColumns.flatMap((column) => column.stages),
    );

    return evaluatedRepairs
      .filter(
        (repair) =>
          !mappedStages.has(
            normalizeStage(repair.repairOrder.stage),
          ),
      )
      .sort(sortRepairs);
  }, [evaluatedRepairs]);

  function getRepairsForColumn(column: BoardColumn) {
    return evaluatedRepairs
      .filter((repair) =>
        column.stages.includes(
          normalizeStage(repair.repairOrder.stage),
        ),
      )
      .sort(sortRepairs);
  }

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">PRODUCTION OPERATIONS</p>
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
            Open Import Center, upload a Nexsyis WIP report, assign
            the store, and click Apply Import.
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
            IMPORTED PRODUCTION WORKFLOW
          </p>

          <h2>Production Board</h2>

          <p className="page-description">
            Review every imported repair by stage, risk, priority,
            ownership, and days onsite.
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
          <span>Visible Repairs</span>
          <strong className="viz-stat-value">
            {visibleOrders.length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Production Holds</span>
          <strong className="viz-stat-value">
            {
              visibleOrders.filter((order) =>
                isProductionHold(order.stage),
              ).length
            }
          </strong>
        </article>

        <article className="metric-card">
          <span>Back Ordered Parts</span>
          <strong className="viz-stat-value">
            {
              visibleOrders.filter((order) =>
                isBackOrderedParts(order.stage),
              ).length
            }
          </strong>
        </article>

        <article className="metric-card">
          <span>Completed Holds</span>
          <strong className="viz-stat-value">
            {
              visibleOrders.filter((order) =>
                isCompletedHold(order.stage),
              ).length
            }
          </strong>
        </article>
      </section>

      <section className="production-board-wrapper">
        <div className="production-board">
          {boardColumns.map((column) => {
            const repairs = getRepairsForColumn(column);

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
                          repair.repairOrder.laborHours,
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
                              {
                                repair.repairOrder
                                  .shop
                              }
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
                              {repair.daysOnSite ?? "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Health</span>
                            <strong>
                              {repair.healthScore}
                            </strong>
                          </div>

                          <div>
                            <span>Priority</span>
                            <strong>
                              {repair.priorityScore}
                            </strong>
                          </div>
                        </div>

                        <div className="production-card-ownership">
                          <span>
                            Tech:{" "}
                            {repair.repairOrder.technician}
                          </span>

                          <span>
                            Est:{" "}
                            {repair.repairOrder.estimator}
                          </span>
                        </div>

                        <small>
                          {getStageDefinition(
                            repair.repairOrder.stage,
                          ).name}
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
                {unmappedRepairs.map((repair, index) => (
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
                        RO {repair.repairOrder.roNumber}
                      </strong>

                      <span
                        className={`status ${riskClass(
                          repair.riskLevel,
                        )}`}
                      >
                        {repair.riskLevel}
                      </span>
                    </div>

                    <h4>{repair.repairOrder.vehicle}</h4>

                    <p>
                      Imported stage:{" "}
                      {repair.repairOrder.stage}
                    </p>

                    <small>
                      Add this stage to the operations
                      dictionary.
                    </small>
                  </button>
                ))}
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
                REPAIR OPERATIONS DETAIL
              </p>

              <h3>
                RO{" "}
                {selectedRepair.repairOrder.roNumber} —{" "}
                {selectedRepair.repairOrder.vehicle}
              </h3>
            </div>

            <button
              className="secondary-button"
              onClick={() => setSelectedRepair(null)}
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
                {selectedRepair.repairOrder.customer}
              </strong>
            </div>

            <div>
              <span>Insurance</span>
              <strong>
                {selectedRepair.repairOrder.insurance}
              </strong>
            </div>

            <div>
              <span>Current Stage</span>
              <strong>{selectedRepair.stageName}</strong>
            </div>

            <div>
              <span>Technician</span>
              <strong>
                {selectedRepair.repairOrder.technician}
              </strong>
            </div>

            <div>
              <span>Estimator</span>
              <strong>
                {selectedRepair.repairOrder.estimator}
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
                {selectedRepair.daysOnSite ?? "Unavailable"}
              </strong>
            </div>

            <div>
              <span>Health Score</span>
              <strong>
                {selectedRepair.healthScore} / 100
              </strong>
            </div>

            <div>
              <span>Priority Score</span>
              <strong>
                {selectedRepair.priorityScore} / 100
              </strong>
            </div>

            <div>
              <span>Blocker</span>
              <strong>{selectedRepair.blocker}</strong>
            </div>
          </div>

          <div className="production-next-action">
            <span>Recommended next action</span>
            <p>{selectedRepair.nextAction}</p>
            <small>
              Suggested owner:{" "}
              {selectedRepair.suggestedOwner}
            </small>
          </div>

          {selectedRepair.healthReasons.length > 0 && (
            <div className="production-score-reasons">
              <h4>Health score factors</h4>

              {selectedRepair.healthReasons.map(
                (reason, index) => (
                  <div key={`${reason.label}-${index}`}>
                    <strong>{reason.points}</strong>

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
