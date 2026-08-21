export type NexsyisRow = Record<string, string> & {
  "Loc Code": string;
  Folder: string;
  "Vehicle Center Tab": string;
  "Repair Stage": string;
  Customer: string;
  Vehicle: string;
  Insurance: string;
  "Sales Resource": string;
  "Service Resource": string;
  "Crash Ops Technician": string;
  "Total Labor Hours": string;
  "Pre Tax Total": string;
  "Created Date": string;
  "Arrival Date": string;
  "Completed Date": string;
};

export const legacyRequiredColumns = [
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
] as const;

const groupedRequiredColumns = [
  "Folder",
  "Customer",
  "Service Resource",
  "Year",
  "Make",
  "Model",
  "Insurance",
  "Arrival",
  "B Hrs",
  "M Hrs",
  "R Hrs",
  "Pre-Tax Total",
  "Stage",
] as const;

type ParseResult = {
  rows: NexsyisRow[];
  missingColumns: string[];
  format: "legacy" | "technician-grouped" | "unknown";
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  const parsed = Number(text(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function headerIndex(headers: string[], name: string) {
  return headers.findIndex(
    (header) => header.toLowerCase() === name.toLowerCase(),
  );
}

function valueAt(row: unknown[], headers: string[], name: string) {
  const index = headerIndex(headers, name);
  return index >= 0 ? text(row[index]) : "";
}

function extractBodyTechnician(value: unknown) {
  const cleaned = text(value).replace(/Â/g, "").replace(/\u00a0/g, " ");
  const match = cleaned.match(/^B Tech:\s*(.*?)\s*(?:---|$)/i);
  const technician = match?.[1]?.trim();

  return technician && !/^-+$/.test(technician) ? technician : "";
}

export function parseWipMatrix(matrix: unknown[][]): ParseResult {
  if (matrix.length === 0) {
    return { rows: [], missingColumns: [], format: "unknown" };
  }

  const headers = matrix[0].map(text);
  const isGroupedReport = groupedRequiredColumns.every((column) =>
    headers.includes(column),
  );

  if (isGroupedReport) {
    const rows: NexsyisRow[] = [];
    let technician = "";

    matrix.slice(1).forEach((sourceRow) => {
      const firstCell = text(sourceRow[0]);

      if (/^B Tech:/i.test(firstCell.replace(/Â/g, "").trim())) {
        technician = extractBodyTechnician(firstCell);
        return;
      }

      const folder = valueAt(sourceRow, headers, "Folder");
      if (!folder) return;

      const year = valueAt(sourceRow, headers, "Year");
      const make = valueAt(sourceRow, headers, "Make");
      const model = valueAt(sourceRow, headers, "Model");
      const stage = valueAt(sourceRow, headers, "Stage");
      const arrival = valueAt(sourceRow, headers, "Arrival");
      const serviceResource = valueAt(
        sourceRow,
        headers,
        "Service Resource",
      );
      const laborHours =
        number(valueAt(sourceRow, headers, "B Hrs")) +
        number(valueAt(sourceRow, headers, "M Hrs")) +
        number(valueAt(sourceRow, headers, "R Hrs"));

      rows.push({
        "Loc Code": "",
        Folder: folder,
        "Vehicle Center Tab": stage,
        "Repair Stage": stage,
        Customer: valueAt(sourceRow, headers, "Customer"),
        Vehicle: [year, make, model].filter(Boolean).join(" "),
        Insurance: valueAt(sourceRow, headers, "Insurance"),
        "Sales Resource": serviceResource,
        "Service Resource": serviceResource,
        "Crash Ops Technician": technician,
        "Total Labor Hours": String(laborHours),
        "Pre Tax Total": valueAt(
          sourceRow,
          headers,
          "Pre-Tax Total",
        ),
        "Created Date": arrival,
        "Arrival Date": arrival,
        "Completed Date": "",
      });
    });

    return {
      rows,
      missingColumns: [],
      format: "technician-grouped",
    };
  }

  // An RO number is the only field required to create a canonical work file.
  // Every other unavailable parameter is intentionally stored as blank.
  const missingColumns = headers.includes("Folder") ? [] : ["Folder"];

  if (missingColumns.length > 0) {
    return { rows: [], missingColumns, format: "unknown" };
  }

  const rows = matrix
    .slice(1)
    .filter((row) => row.some((value) => text(value)))
    .map((sourceRow) => {
      const raw = Object.fromEntries(
        headers.map((header, index) => [header, text(sourceRow[index])]),
      );
      return {
        ...raw,
        "Loc Code": valueAt(sourceRow, headers, "Loc Code"),
        Folder: valueAt(sourceRow, headers, "Folder"),
        "Vehicle Center Tab": valueAt(sourceRow, headers, "Vehicle Center Tab"),
        "Repair Stage": valueAt(sourceRow, headers, "Repair Stage"),
        Customer: valueAt(sourceRow, headers, "Customer"),
        Vehicle: valueAt(sourceRow, headers, "Vehicle"),
        Insurance: valueAt(sourceRow, headers, "Insurance"),
        "Sales Resource": valueAt(sourceRow, headers, "Sales Resource"),
        "Service Resource": valueAt(sourceRow, headers, "Service Resource"),
        "Crash Ops Technician": valueAt(sourceRow, headers, "Crash Ops Technician") || valueAt(sourceRow, headers, "Service Resource"),
        "Total Labor Hours": valueAt(sourceRow, headers, "Total Labor Hours"),
        "Pre Tax Total": valueAt(sourceRow, headers, "Pre Tax Total"),
        "Created Date": valueAt(sourceRow, headers, "Created Date"),
        "Arrival Date": valueAt(sourceRow, headers, "Arrival Date"),
        "Completed Date": valueAt(sourceRow, headers, "Completed Date"),
      } as NexsyisRow;
    });

  return { rows, missingColumns: [], format: "legacy" };
}

export async function parseWipWorkbook(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    cellDates: true,
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  return parseWipMatrix(matrix);
}
