import { useState } from "react";
import { supabase } from "../lib/supabase";

const timeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
];

export default function FirstRunSetup({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [organizationName, setOrganizationName] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [centerName, setCenterName] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function finishSetup() {
    if (!supabase) return;
    setSaving(true);
    setError("");
    const { error: setupError } = await supabase.rpc("bootstrap_organization", {
      organization_name: organizationName,
      organization_timezone: timeZone,
      center_name: centerName,
      center_code: shopCode || null,
    });
    setSaving(false);
    if (setupError) {
      setError(setupError.message);
      return;
    }
    onComplete();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card setup-card">
        <p className="eyebrow">FIRST RUN SETUP</p>
        <h1>Build your Crash Ops workspace</h1>
        <p className="auth-subtitle">Create the organization, first center, administrator profile, and center access in one guided flow.</p>
        <div className="setup-steps"><span className={step === 1 ? "active" : ""}>1 Company</span><span className={step === 2 ? "active" : ""}>2 Center</span><span className={step === 3 ? "active" : ""}>3 Launch</span></div>
        {step === 1 && <div className="auth-form"><label>Organization Name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Crash Ops Collision Group" /></label><label>Time Zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label><button disabled={!organizationName.trim()} onClick={() => setStep(2)} type="button">Continue</button></div>}
        {step === 2 && <div className="auth-form"><label>Center Name<input value={centerName} onChange={(event) => setCenterName(event.target.value)} placeholder="North Austin Collision Center" /></label><label>Shop Code <span>Optional</span><input value={shopCode} onChange={(event) => setShopCode(event.target.value)} placeholder="AUS01" /></label><button disabled={!centerName.trim()} onClick={() => setStep(3)} type="button">Review setup</button><button className="text-button" onClick={() => setStep(1)} type="button">Back</button></div>}
        {step === 3 && <div className="auth-form"><div className="review-card"><strong>{organizationName}</strong><span>{timeZone}</span><strong>{centerName}</strong><span>{shopCode || "No shop code"}</span></div>{error && <p className="auth-error">{error}</p>}<button disabled={saving} onClick={() => void finishSetup()} type="button">{saving ? "Creating workspace…" : "Create workspace & open Mission Control"}</button><button className="text-button" onClick={() => setStep(2)} type="button">Back</button></div>}
      </section>
    </main>
  );
}
