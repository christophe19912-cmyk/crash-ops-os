import type {
  ImportedWipRecord,
  RepairOrder,
} from "../models/RepairOrder";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "crashOpsLastWipImport";
const UPDATED_EVENT = "crash-ops:wip-import-updated";
let cachedSource: string | null | undefined;
let cachedRecord: ImportedWipRecord | null = null;

export function cleanNumber(value: unknown) {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function loadImportedWip(): ImportedWipRecord | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === cachedSource) return cachedRecord;
    cachedSource = stored;

    if (!stored) {
      cachedRecord = null;
      return null;
    }

    cachedRecord = JSON.parse(stored) as ImportedWipRecord;
    return cachedRecord;
  } catch {
    cachedRecord = null;
    return null;
  }
}

export function saveImportedWip(record: ImportedWipRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  cachedSource = undefined;
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

function subscribeToImportedWip(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedSource = undefined;
      onChange();
    }
  };
  const onUpdated = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(UPDATED_EVENT, onUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(UPDATED_EVENT, onUpdated);
  };
}

export function useImportedWip(): ImportedWipRecord | null {
  return useSyncExternalStore(subscribeToImportedWip, loadImportedWip, () => null);
}

export function normalizeRepairOrders(
  record: ImportedWipRecord | null,
): RepairOrder[] {
  if (!record?.rows?.length) return [];

  return record.rows.map((row) => ({
    shop:
  row["Crash Ops Shop"]?.trim() ||
  row["Loc Code"]?.trim() ||
  "Unknown",
    roNumber: row.Folder?.trim() || "Unknown",
    customer: row.Customer?.trim() || "Unknown",
    vehicle: row.Vehicle?.trim() || "Unknown",
    stage: row["Repair Stage"]?.trim() || "Unassigned",
    laborHours: cleanNumber(row["Total Labor Hours"]),
    preTaxTotal: cleanNumber(row["Pre Tax Total"]),
    estimator: row["Sales Resource"]?.trim() || "Unassigned",
    technician:
      row["Crash Ops Technician"]?.trim() ||
      row["Service Resource"]?.trim() ||
      "Unassigned",
    insurance: row.Insurance?.trim() || "Unknown",
    createdDate: row["Created Date"]?.trim() || "",
    arrivalDate: row["Arrival Date"]?.trim() || "",
    completedDate: row["Completed Date"]?.trim() || "",
    vehicleStatus:
      row["Vehicle Center Tab"]?.trim() || "Unknown",
  }));
}

export function parseReportDate(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function daysSince(value: string) {
  const date = parseReportDate(value);

  if (!date) return null;

  const difference = Date.now() - date.getTime();

  return Math.max(
    0,
    Math.floor(difference / (1000 * 60 * 60 * 24)),
  );
}
