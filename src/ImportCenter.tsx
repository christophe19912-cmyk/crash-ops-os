import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { SHOP_OPTIONS } from "./services/capacitySettings";
import { cleanNumber } from "./services/importedData";

type NexsyisRow = {
  "Loc Code": string;
  Folder: string;
  "Vehicle Center Tab": string;
  "Repair Stage": string;
  Customer: string;
  Vehicle: string;
  Insurance: string;
  "Sales Resource": string;
  "Service Resource": string;
  "Total Labor Hours": string;
  "Pre Tax Total": string;
  "Created Date": string;
  "Arrival Date": string;
  "Completed Date": string;
};

type ImportIssue = {
  row: number;
  message: string;
};

const requiredColumns: (keyof NexsyisRow)[] = [
  "Loc Code",
  "Folder",
  "Vehicle Center Tab",
  "Repair Stage",
  "Customer",
  "Vehicle",
  "Insurance",
  "Sales Resource",
  "Service Resource",
  "Total Labor Hours",
  "Pre Tax Total",
  "Created Date",
  "Arrival Date",
  "Completed Date",
];

function ImportCenter() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
const [selectedShop, setSelectedShop] =
  useState("North Hills");
  const [rows, setRows] = useState<NexsyisRow[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [importApplied, setImportApplied] = useState(false);
  const [parseError, setParseError] = useState("");

  const summary = useMemo(() => {
    const totalLaborHours = rows.reduce(
      (total, row) =>
        total + cleanNumber(row["Total Labor Hours"]),
      0,
    );

    const totalPreTaxSales = rows.reduce(
      (total, row) => total + cleanNumber(row["Pre Tax Total"]),
      0,
    );

    const stages = rows.reduce<Record<string, number>>(
      (totals, row) => {
        const stage = row["Repair Stage"]?.trim() || "Unassigned";
        totals[stage] = (totals[stage] || 0) + 1;
        return totals;
      },
      {},
    );

    const locations = Array.from(
      new Set(
        rows
          .map((row) => row["Loc Code"]?.trim())
          .filter(Boolean),
      ),
    );

    const technicians = Array.from(
      new Set(
        rows
          .map((row) => row["Service Resource"]?.trim())
          .filter(Boolean),
      ),
    );

    const estimators = Array.from(
      new Set(
        rows
          .map((row) => row["Sales Resource"]?.trim())
          .filter(Boolean),
      ),
    );

    return {
      vehicles: rows.length,
      totalLaborHours,
      totalPreTaxSales,
      stages,
      locations,
      technicians,
      estimators,
    };
  }, [rows]);

  function validateRows(importRows: NexsyisRow[]) {
    const validationIssues: ImportIssue[] = [];

    importRows.forEach((row, index) => {
      const reportRow = index + 2;

      if (!row.Folder?.trim()) {
        validationIssues.push({
          row: reportRow,
          message: "Missing folder/repair-order number.",
        });
      }

      if (!row.Vehicle?.trim()) {
        validationIssues.push({
          row: reportRow,
          message: "Missing vehicle description.",
        });
      }

      if (!row["Repair Stage"]?.trim()) {
        validationIssues.push({
          row: reportRow,
          message: "Missing repair stage.",
        });
      }

      const laborValue = row["Total Labor Hours"];

      if (
        laborValue?.trim() &&
        !Number.isFinite(cleanNumber(laborValue))
      ) {
        validationIssues.push({
          row: reportRow,
          message: "Invalid total labor-hours value.",
        });
      }
    });

    return validationIssues;
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setRows([]);
    setIssues([]);
    setMissingColumns([]);
    setImportApplied(false);
    setParseError("");

    Papa.parse<NexsyisRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];

        const missing = requiredColumns.filter(
          (column) => !headers.includes(column),
        );

        setMissingColumns(missing);

        if (missing.length > 0) {
          setParseError(
            "This file does not match the expected Nexsyis WIP report layout.",
          );
          return;
        }

        const importedRows = results.data.filter((row) =>
          Object.values(row).some((value) =>
            String(value ?? "").trim(),
          ),
        );

        setRows(importedRows);
        setIssues(validateRows(importedRows));
      },
      error: (error) => {
        setParseError(error.message);
      },
    });
  }

  function applyImport() {
    const importRecord = {
  source: "Nexsyis WIP CSV",
  fileName,
  importedAt: new Date().toISOString(),
  rowCount: rows.length,
  selectedShop,
  rows: rows.map((row) => ({
    ...row,
    "Crash Ops Shop": selectedShop,
  })),
};

    localStorage.setItem(
      "crashOpsLastWipImport",
      JSON.stringify(importRecord),
    );

    setImportApplied(true);
  }

  function clearImport() {
    setFileName("");
    setRows([]);
    setIssues([]);
    setMissingColumns([]);
    setImportApplied(false);
    setParseError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const canApply =
    rows.length > 0 &&
    missingColumns.length === 0 &&
    !parseError;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">DATA INGESTION</p>
          <h2>Import Center</h2>
          <p className="page-description">
            Upload a Nexsyis Work in Process CSV and convert it into
            operational data for Crash Ops OS.
          </p>
        </div>
      </header>

      <section className="panel import-upload-panel">
        <div className="import-upload-copy">
          <div className="import-icon">CSV</div>

          <div>
            <h3>Upload Nexsyis WIP Report</h3>
            <p>
              Export the Work in Process report as CSV, then select it
              here. The original report remains unchanged.
            </p>
          </div>
        </div>

        <div className="import-upload-actions">
  <label className="import-shop-selector">
    <span>Report belongs to</span>

    <select
      onChange={(event) =>
        setSelectedShop(event.target.value)
      }
      value={selectedShop}
    >
      {SHOP_OPTIONS.map((shop) => (
        <option key={shop} value={shop}>
          {shop}
        </option>
      ))}
    </select>
  </label>

  <input
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
            ref={fileInputRef}
            type="file"
          />

          {rows.length > 0 && (
            <button
              className="secondary-button"
              onClick={clearImport}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {parseError && (
        <section className="panel import-error">
          <h3>Import could not be completed</h3>
          <p>{parseError}</p>

          {missingColumns.length > 0 && (
            <div>
              <strong>Missing columns:</strong>
              <p>{missingColumns.join(", ")}</p>
            </div>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <>
          <section className="cards import-summary-cards">
            <article className="card">
              <p>Repair Orders</p>
              <strong>{summary.vehicles}</strong>
              <small>Rows recognized</small>
            </article>

            <article className="card">
              <p>Labor Hours</p>
              <strong>
                {summary.totalLaborHours.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
              </strong>
              <small>Total work represented</small>
            </article>

            <article className="card">
              <p>Pre-Tax Value</p>
              <strong>
                {summary.totalPreTaxSales.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </strong>
              <small>Open repair value</small>
            </article>

            <article className="card">
              <p>Validation Issues</p>
              <strong>{issues.length}</strong>
              <small>
                {issues.length === 0
                  ? "No row-level problems found"
                  : "Review before relying on results"}
              </small>
            </article>
          </section>

          <section className="import-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">REPORT SUMMARY</p>
                  <h3>{fileName}</h3>
                </div>
              </div>

              <div className="import-metadata-grid">
                <div>
                  <span>Locations found</span>
                  <strong>
                    {summary.locations.join(", ") || "None"}
                  </strong>
                </div>

                <div>
                  <span>Estimators found</span>
                  <strong>{summary.estimators.length}</strong>
                </div>

                <div>
                  <span>Service resources found</span>
                  <strong>{summary.technicians.length}</strong>
                </div>

                <div>
                  <span>Production stages found</span>
                  <strong>{Object.keys(summary.stages).length}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">STAGE BREAKDOWN</p>
                  <h3>Current Repair Stages</h3>
                </div>
              </div>

              <div className="stage-summary-list">
                {Object.entries(summary.stages)
                  .sort((a, b) => b[1] - a[1])
                  .map(([stage, count]) => (
                    <div key={stage}>
                      <span>{stage}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
              </div>
            </article>
          </section>

          {issues.length > 0 && (
            <section className="panel import-issues-panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">REVIEW REQUIRED</p>
                  <h3>Validation Issues</h3>
                </div>
              </div>

              <div className="import-issue-list">
                {issues.slice(0, 20).map((issue, index) => (
                  <div key={`${issue.row}-${index}`}>
                    <strong>Row {issue.row}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel import-preview-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">IMPORT PREVIEW</p>
                <h3>First 15 Repair Orders</h3>
              </div>
            </div>

            <div className="import-table-wrapper">
              <div className="import-table">
                <div className="import-row import-row-header">
                  <span>Folder</span>
                  <span>Stage</span>
                  <span>Customer</span>
                  <span>Vehicle</span>
                  <span>Insurance</span>
                  <span>Estimator</span>
                  <span>Technician</span>
                  <span>Labor Hours</span>
                  <span>Arrival</span>
                </div>

                {rows.slice(0, 15).map((row, index) => (
                  <div
                    className="import-row"
                    key={`${row.Folder}-${index}`}
                  >
                    <strong>{row.Folder || "—"}</strong>
                    <span>{row["Repair Stage"] || "—"}</span>
                    <span>{row.Customer || "—"}</span>
                    <span>{row.Vehicle || "—"}</span>
                    <span>{row.Insurance || "—"}</span>
                    <span>{row["Sales Resource"] || "—"}</span>
                    <span>{row["Service Resource"] || "—"}</span>
                    <span>
                      {cleanNumber(
                        row["Total Labor Hours"],
                      ).toFixed(1)}
                    </span>
                    <span>{row["Arrival Date"] || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="import-apply-bar">
            <div>
              <strong>
                {importApplied
                  ? "Import saved successfully"
                  : `${rows.length} repair orders are ready`}
              </strong>

              <span>
                {importApplied
                  ? "The latest WIP import is stored in this browser."
                  : "Review the summary and preview before applying."}
              </span>
            </div>

            <button
              className="primary-button"
              disabled={!canApply || importApplied}
              onClick={applyImport}
              type="button"
            >
              {importApplied ? "Import Applied" : "Apply Import"}
            </button>
          </section>
        </>
      )}
    </>
  );
}

export default ImportCenter;
