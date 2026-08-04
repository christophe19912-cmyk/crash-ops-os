import { supabaseEnvironment } from "../lib/supabase";

export default function ConfigurationScreen() {
  return (
    <main className="configuration-layout">
      <section className="configuration-card">
        <div className="configuration-icon">⚙</div>
        <p className="auth-eyebrow">DEPLOYMENT SETUP</p>
        <h1>Connect Crash Ops OS</h1>
        <p>Add your Supabase browser credentials before authentication can start.</p>
        <div className="configuration-variables">
          <div><span className={supabaseEnvironment.hasUrl ? "configured" : "missing"}>{supabaseEnvironment.hasUrl ? "✓" : "!"}</span><code>VITE_SUPABASE_URL</code><small>{supabaseEnvironment.hasUrl ? "Configured" : "Missing"}</small></div>
          <div><span className={supabaseEnvironment.hasPublishableKey ? "configured" : "missing"}>{supabaseEnvironment.hasPublishableKey ? "✓" : "!"}</span><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><small>{supabaseEnvironment.hasPublishableKey ? "Configured" : "Missing"}</small></div>
        </div>
        <ol><li>Copy <code>.env.example</code> to <code>.env.local</code>.</li><li>Add the project URL and publishable key.</li><li>Restart the development server.</li></ol>
        <p className="configuration-security">Use only a publishable or anon key here. Never expose a service-role key in the browser.</p>
      </section>
    </main>
  );
}
