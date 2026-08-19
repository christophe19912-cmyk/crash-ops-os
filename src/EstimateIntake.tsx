import { useState } from "react";
import type { ChangeEvent } from "react";
import type { RepairSeverity, ScheduleDay } from "./models/ScheduledDrop";
import { addScheduledDrop, loadScheduledDrops, SCHEDULE_DAYS } from "./services/scheduleStorage";

export type EstimateScanResult = {
  customer: string;
  vehicle: string;
  vin: string;
  cccJobNumber: string;
  claimNumber: string;
  workfileId: string;
  insuranceCompany: string;
  estimator: string;
  bodyLaborHours: number;
  paintLaborHours: number;
  frameLaborHours: number;
  mechanicalLaborHours: number;
  totalLaborHours: number;
  partsTotal: number;
  bodyLaborTotal: number;
  paintLaborTotal: number;
  paintMaterialsTotal: number;
  salesTax: number;
  totalCostOfRepairs: number;
  deductible: number;
  adjustments: number;
  netCostOfRepairs: number;
  confidenceNotes: string[];
};

type Props = { onScheduled?: () => void };

const emptyResult: EstimateScanResult = {
  customer: "", vehicle: "", vin: "", cccJobNumber: "", claimNumber: "", workfileId: "",
  insuranceCompany: "", estimator: "", bodyLaborHours: 0, paintLaborHours: 0, frameLaborHours: 0,
  mechanicalLaborHours: 0, totalLaborHours: 0, partsTotal: 0, bodyLaborTotal: 0, paintLaborTotal: 0,
  paintMaterialsTotal: 0, salesTax: 0, totalCostOfRepairs: 0, deductible: 0, adjustments: 0,
  netCostOfRepairs: 0, confidenceNotes: [],
};

function money(value: number) {
  return value ? value.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function createPhotoThumbnail(file: File): Promise<string> {
  const source = await fileToDataUrl(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 480;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) return resolve(source);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

export default function EstimateIntake({ onScheduled }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [vehiclePhotoPreview, setVehiclePhotoPreview] = useState("");
  const [result, setResult] = useState<EstimateScanResult>(emptyResult);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [shop, setShop] = useState("North Hills");
  const [day, setDay] = useState<ScheduleDay>("Monday");
  const [severity, setSeverity] = useState<RepairSeverity>("Medium");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  function addEstimateFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    setFiles((current) => {
      const combined = [...current, ...selected];
      const unique = combined.filter((file, index, all) =>
        all.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index,
      );
      return unique.slice(0, 4);
    });
    setSaved(false);
    setError("");
    event.target.value = "";
  }

  async function pickVehiclePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setVehiclePhoto(file);
    setVehiclePhotoPreview(file ? await createPhotoThumbnail(file) : "");
    event.target.value = "";
  }

  function clearEstimateFiles() {
    setFiles([]);
    setSaved(false);
    setError("");
  }

  async function scanEstimate() {
    if (!files.length) return setError("Add at least one CCC estimate image before scanning.");
    setScanning(true); setError(""); setSaved(false);
    try {
      const documents = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) })));
      const response = await fetch("/api/estimate-intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documents }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Estimate scan failed.");
      setResult({ ...emptyResult, ...payload });
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Estimate scan failed.");
    } finally { setScanning(false); }
  }

  function updateText(key: keyof EstimateScanResult, value: string) { setResult((current) => ({ ...current, [key]: value })); }
  function updateNumber(key: keyof EstimateScanResult, value: string) { setResult((current) => ({ ...current, [key]: Number(value) || 0 })); }

  function addToSchedule() {
    if (!result.customer && !result.vehicle && !result.cccJobNumber) return setError("Scan or enter the job information before adding it to the schedule.");
    const existing = loadScheduledDrops();
    if (existing.some((drop) => Boolean(result.cccJobNumber) && drop.cccJobNumber === result.cccJobNumber)) return setError(`CCC job ${result.cccJobNumber} is already scheduled.`);

    addScheduledDrop(existing, {
      shop, day, customer: result.customer.trim() || "Customer TBD", vehicle: result.vehicle.trim() || "Vehicle TBD",
      roNumber: result.cccJobNumber.trim() || "Pending", estimatedLaborHours: result.totalLaborHours, severity, notes: notes.trim(),
      vin: result.vin, cccJobNumber: result.cccJobNumber, claimNumber: result.claimNumber, workfileId: result.workfileId,
      insuranceCompany: result.insuranceCompany, estimator: result.estimator, bodyLaborHours: result.bodyLaborHours,
      paintLaborHours: result.paintLaborHours, frameLaborHours: result.frameLaborHours, mechanicalLaborHours: result.mechanicalLaborHours,
      partsTotal: result.partsTotal, bodyLaborTotal: result.bodyLaborTotal, paintLaborTotal: result.paintLaborTotal,
      paintMaterialsTotal: result.paintMaterialsTotal, salesTax: result.salesTax, totalCostOfRepairs: result.totalCostOfRepairs,
      deductible: result.deductible, adjustments: result.adjustments, netCostOfRepairs: result.netCostOfRepairs,
      estimateImageName: files[0]?.name || "", vehiclePhotoDataUrl: vehiclePhotoPreview,
    });
    setSaved(true); setError(""); onScheduled?.();
  }

  const textFields: Array<[keyof EstimateScanResult, string]> = [
    ["customer", "Customer"], ["vehicle", "Vehicle"], ["vin", "VIN"], ["cccJobNumber", "CCC Job #"],
    ["claimNumber", "Claim #"], ["workfileId", "Workfile ID"], ["insuranceCompany", "Insurance Company"], ["estimator", "Estimator"],
  ];
  const numberFields: Array<[keyof EstimateScanResult, string, string]> = [
    ["bodyLaborHours", "Body Labor", "hrs"], ["paintLaborHours", "Paint Labor", "hrs"], ["frameLaborHours", "Frame Labor", "hrs"],
    ["mechanicalLaborHours", "Mechanical Labor", "hrs"], ["totalLaborHours", "Total Labor", "hrs"], ["partsTotal", "Parts", "$"],
    ["bodyLaborTotal", "Body Labor $", "$"], ["paintLaborTotal", "Paint Labor $", "$"], ["paintMaterialsTotal", "Paint & Materials", "$"],
    ["salesTax", "Sales Tax", "$"], ["totalCostOfRepairs", "Total Cost of Repairs", "$"], ["deductible", "Deductible", "$"],
    ["adjustments", "Adjustments", "$"], ["netCostOfRepairs", "Net Cost of Repairs", "$"],
  ];

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">CCC INTAKE · SCHEDULE/WIP</p><h2>Estimate Intake</h2><p className="page-description">Photograph the CCC cover and totals pages, or choose existing images from your phone/files, verify the extracted job data, attach a vehicle photo, then add the repair directly to the schedule.</p></div></header>

      <section className="panel">
        <div className="panel-header"><div><p className="section-label">STEP 1</p><h3>Scan CCC Estimate</h3></div></div>
        <div className="scheduling-form-grid">
          <label>
            <span>Take estimate photo</span>
            <input accept="image/*" capture="environment" onChange={addEstimateFiles} type="file" />
            <small>Opens the rear camera. Add the cover and totals pages one at a time.</small>
          </label>
          <label>
            <span>Choose photos / image files</span>
            <input accept="image/jpeg,image/png,image/webp" multiple onChange={addEstimateFiles} type="file" />
            <small>Select existing screenshots or estimate images from Photos or Files. Up to 4 total images.</small>
          </label>
          <label><span>Center</span><input value={shop} onChange={(e) => setShop(e.target.value)} /></label>
        </div>
        {files.length > 0 && (
          <div>
            <p>{files.length} estimate image{files.length === 1 ? "" : "s"} ready: {files.map((file) => file.name).join(", ")}</p>
            <button className="text-button" onClick={clearEstimateFiles} type="button">Clear estimate images</button>
          </div>
        )}
        <div className="scheduling-form-actions"><button className="primary-button" disabled={scanning} onClick={() => void scanEstimate()} type="button">{scanning ? "Reading CCC Estimate…" : "Scan Estimate"}</button></div>
        {error && <div className="context-banner error">{error}</div>}
      </section>

      <section className="panel scheduling-form-panel">
        <div className="panel-header"><div><p className="section-label">STEP 2</p><h3>Review Extracted Job</h3></div></div>
        <div className="scheduling-form-grid">{textFields.map(([key, label]) => <label key={String(key)}><span>{label}</span><input value={String(result[key] || "")} onChange={(e) => updateText(key, e.target.value)} /></label>)}</div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><p className="section-label">PRODUCTION + FINANCIAL</p><h3>CCC Totals</h3></div></div>
        <div className="scheduling-form-grid">{numberFields.map(([key, label, suffix]) => <label key={String(key)}><span>{label}</span><input min="0" step="0.01" type="number" value={Number(result[key]) || ""} onChange={(e) => updateNumber(key, e.target.value)} /><small>{suffix === "$" ? money(Number(result[key])) : suffix}</small></label>)}</div>
        {result.confidenceNotes.length > 0 && <div className="wip-recommendation"><span>Scan review notes</span><p>{result.confidenceNotes.join(" • ")}</p></div>}
      </section>

      <section className="panel scheduling-form-panel">
        <div className="panel-header"><div><p className="section-label">STEP 3</p><h3>Add to Schedule</h3></div></div>
        <div className="scheduling-form-grid">
          <label><span>Drop Day</span><select value={day} onChange={(e) => setDay(e.target.value as ScheduleDay)}>{SCHEDULE_DAYS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Severity</span><select value={severity} onChange={(e) => setSeverity(e.target.value as RepairSeverity)}><option>Light</option><option>Medium</option><option>Heavy</option></select></label>
          <label><span>Take vehicle / damage photo</span><input accept="image/*" capture="environment" onChange={(e) => void pickVehiclePhoto(e)} type="file" /><small>Use the camera for a new photo.</small></label>
          <label><span>Choose vehicle / damage photo</span><input accept="image/*" onChange={(e) => void pickVehiclePhoto(e)} type="file" /><small>Select an existing photo from Photos or Files.</small></label>
          <label className="scheduling-notes-field"><span>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parts, tow-in, insurance, or scheduling notes" /></label>
        </div>
        {vehiclePhoto && <small>{vehiclePhoto.name} attached</small>}
        {vehiclePhotoPreview && <img src={vehiclePhotoPreview} alt="Vehicle preview" style={{ maxWidth: 320, borderRadius: 12, marginTop: 12 }} />}
        <div className="scheduling-form-actions"><button className="primary-button" onClick={addToSchedule} type="button">Add to Schedule</button></div>
        {saved && <div className="context-banner">Job added to the schedule with CCC identity, labor-hour, estimate-total, and vehicle-photo data.</div>}
      </section>
    </>
  );
}
