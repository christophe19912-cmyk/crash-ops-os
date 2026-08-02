import { useMemo, useState } from "react";
import { buildIntelligenceSnapshot } from "./engine/intelligence";
import { buildTechnicianLoadSnapshot } from "./engine/technician/technicianEngine";
import type {
  TechnicianLoad,
  TechnicianLoadStatus,
} from "./engine/technician/technicianTypes";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function statusClass(status: TechnicianLoadStatus) {
  if (status === "Available" || status === "Balanced") {
    return "good";
  }

  if (status === "Near Capacity") {
    return "warning";
  }

  return "alert";
}

function TechnicianLoadDashboard() {
  const importedRecord = useMemo(loadImportedWip, []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const intelligence = useMemo(
    () => buildIntelligenceSnapshot(repairOrders),
    [repairOrders],
  );

  const technicianLoad = useMemo(
    () => buildTechnicianLoadSnapshot(intelligence),
    [intelligence],
  );

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const [selectedTechnician, setSelectedTechnician] =
    useState<TechnicianLoad | null>(null);

  const visibleTechnicians =
    selectedShop === "All Locations"
      ? technicianLoad.technicians
      : technicianLoad.technicians.filter(
          (technician) =>
            technician.shop === selectedShop,
        );

  const visibleAssignedHours =
    visibleTechnicians.reduce(
      (total, technician) =>
        total + technician.assignedLaborHours,
      0,
    );

  const visibleOverloaded =
    visibleTechnicians.filter(
      (technician) =>
        technician.status === "Overloaded" ||
        technician.status === "Near Capacity",
    ).length;

  const visibleAvailable =
    visibleTechnicians.filter(
      (technician) =>
        technician.status === "Available",
    ).length;

  const visibleUnassigned =
    visibleTechnicians
      .filter(
        (technician) =>
          technician.status === "Unassigned",
      )
      .reduce(
        (total, technician) =>
          total + technician.assignedRepairCount,
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
            <h2>Technician Load</h2>
            <p className="page-description">
              Compare assigned labor hours against shop-derived
              technician capacity.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">TL</div>
          <h3>No imported WIP data found</h3>
          <p>
            Apply a WIP import before calculating technician
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
            INTELLIGENCE CORE · WORKFORCE
          </p>
          <h2>Technician Load</h2>
          <p className="page-description">
            Identify available, balanced, near-capacity,
            overloaded, and unassigned production workload.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setSelectedTechnician(null);
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
          <p>Assigned Labor Hours</p>
          <strong>{visibleAssignedHours.toFixed(1)}</strong>
          <small>Active production workload</small>
        </article>

        <article className="card">
          <p>Overloaded / Near Capacity</p>
          <strong>{visibleOverloaded}</strong>
          <small>Technicians requiring load review</small>
        </article>

        <article className="card">
          <p>Available Technicians</p>
          <strong>{visibleAvailable}</strong>
          <small>Below 80% of weekly capacity</small>
        </article>

        <article className="card">
          <p>Unassigned Repairs</p>
          <strong>{visibleUnassigned}</strong>
          <small>Active repairs without technician ownership</small>
        </article>
      </section>

      <section className="technician-load-grid">
        {visibleTechnicians.map((technician) => (
          <article
            className="panel technician-load-card"
            key={technician.id}
          >
            <div className="technician-load-heading">
              <div>
                <p className="section-label">
                  {technician.shop}
                </p>
                <h3>{technician.technician}</h3>
              </div>

              <span
                className={`status ${statusClass(
                  technician.status,
                )}`}
              >
                {technician.status}
              </span>
            </div>

            <div className="technician-utilization">
              <div>
                <span>Utilization</span>
                <strong>
                  {technician.status === "Unassigned"
                    ? "—"
                    : `${technician.utilizationPercent.toFixed(
                        0,
                      )}%`}
                </strong>
              </div>

              <div className="technician-utilization-track">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      technician.utilizationPercent,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="technician-load-metrics">
              <div>
                <span>Repairs</span>
                <strong>
                  {technician.assignedRepairCount}
                </strong>
              </div>

              <div>
                <span>Assigned</span>
                <strong>
                  {technician.assignedLaborHours.toFixed(1)} hrs
                </strong>
              </div>

              <div>
                <span>Capacity</span>
                <strong>
                  {technician.status === "Unassigned"
                    ? "—"
                    : `${technician.weeklyCapacityHours.toFixed(
                        1,
                      )} hrs`}
                </strong>
              </div>

              <div>
                <span>Remaining</span>
                <strong>
                  {technician.status === "Unassigned"
                    ? "—"
                    : `${technician.remainingCapacityHours.toFixed(
                        1,
                      )} hrs`}
                </strong>
              </div>

              <div>
                <span>High Risk</span>
                <strong>
                  {technician.highRiskRepairCount}
                </strong>
              </div>

              <div>
                <span>Holds / BOP</span>
                <strong>
                  {technician.productionHoldCount} /{" "}
                  {technician.backOrderedPartsCount}
                </strong>
              </div>
            </div>

            <div className="wip-recommendation">
              <span>Load recommendation</span>
              <p>{technician.recommendation}</p>
            </div>

            <button
              className="secondary-button technician-detail-button"
              onClick={() =>
                setSelectedTechnician(technician)
              }
              type="button"
            >
              View Assigned Repairs
            </button>
          </article>
        ))}
      </section>

      {selectedTechnician && (
        <section className="panel technician-repair-detail">
          <div className="panel-header">
            <div>
              <p className="section-label">
                ASSIGNED REPAIR DETAIL
              </p>
              <h3>
                {selectedTechnician.technician} ·{" "}
                {selectedTechnician.shop}
              </h3>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setSelectedTechnician(null)
              }
              type="button"
            >
              Close
            </button>
          </div>

          <div className="technician-repair-list">
            {selectedTechnician.repairs.map((repair) => (
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
                  <span>Labor</span>
                  <strong>
                    {repair.laborHours.toFixed(1)} hrs
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

export default TechnicianLoadDashboard;
