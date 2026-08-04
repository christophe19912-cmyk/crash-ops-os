import {
  useEffect,
  useState,
} from "react";
import {
  isSupabaseConfigured,
  supabase,
  supabaseEnvironment,
} from "./lib/supabase";

type ConnectionState =
  | "Not Configured"
  | "Checking"
  | "Connected"
  | "Connection Error";

function BetaSetup() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>(
      isSupabaseConfigured
        ? "Checking"
        : "Not Configured",
    );

  const [connectionMessage, setConnectionMessage] =
    useState(
      isSupabaseConfigured
        ? "Checking the Supabase project connection."
        : "Add the Supabase project URL and publishable key to .env.local.",
    );

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      if (!supabase) return;

      const { error } =
        await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setConnectionState("Connection Error");
        setConnectionMessage(error.message);
        return;
      }

      setConnectionState("Connected");
      setConnectionMessage(
        "The browser client can reach the Supabase project. Authentication is not enabled in the app yet.",
      );
    }

    void checkConnection();

    return () => {
      active = false;
    };
  }, []);

  const configured =
    connectionState === "Connected";

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            BETA FOUNDATION · PHASE 1A
          </p>

          <h2>Beta Setup</h2>

          <p className="page-description">
            Validate the Supabase connection and track the
            security foundation required before external beta
            testing.
          </p>
        </div>
      </header>

      <section className="beta-setup-status-grid">
        <article className="panel">
          <span className="beta-setup-label">
            Connection Status
          </span>

          <strong
            className={
              configured
                ? "beta-setup-value connected"
                : "beta-setup-value"
            }
          >
            {connectionState}
          </strong>

          <p>{connectionMessage}</p>
        </article>

        <article className="panel">
          <span className="beta-setup-label">
            Project URL
          </span>

          <strong className="beta-setup-value">
            {supabaseEnvironment.hasUrl
              ? "Configured"
              : "Missing"}
          </strong>

          <p>
            Variable:{" "}
            <code>VITE_SUPABASE_URL</code>
          </p>
        </article>

        <article className="panel">
          <span className="beta-setup-label">
            Publishable Key
          </span>

          <strong className="beta-setup-value">
            {supabaseEnvironment.hasPublishableKey
              ? "Configured"
              : "Missing"}
          </strong>

          <p>
            Variable:{" "}
            <code>
              VITE_SUPABASE_PUBLISHABLE_KEY
            </code>
          </p>
        </article>
      </section>

      <section className="panel beta-setup-checklist">
        <div className="panel-header">
          <div>
            <p className="section-label">
              PHASE 1 SECURITY ROADMAP
            </p>
            <h3>Beta Foundation Checklist</h3>
          </div>
        </div>

        <div className="beta-checklist-list">
          <div className="complete">
            <span>1A</span>
            <section>
              <strong>
                Supabase schema and connection
              </strong>
              <p>
                Client, environment validation, database
                migration, tenant model, and RLS foundation.
              </p>
            </section>
          </div>

          <div>
            <span>1B</span>
            <section>
              <strong>
                Password authentication
              </strong>
              <p>
                Sign in, password reset, protected app,
                session restoration, and logout.
              </p>
            </section>
          </div>

          <div>
            <span>1C</span>
            <section>
              <strong>
                User roles and shop access
              </strong>
              <p>
                Platform Admin, Organization Admin,
                Regional Manager, and Shop Manager.
              </p>
            </section>
          </div>

          <div>
            <span>1D</span>
            <section>
              <strong>Cloud application store</strong>
              <p>
                WIP imports, repairs, capacity settings,
                estimator settings, and scheduled drops.
              </p>
            </section>
          </div>
        </div>
      </section>

      <section className="panel beta-setup-instructions">
        <div className="panel-header">
          <div>
            <p className="section-label">
              REQUIRED MANUAL SETUP
            </p>
            <h3>Connect the Supabase Project</h3>
          </div>
        </div>

        <ol>
          <li>
            Create a Supabase project.
          </li>
          <li>
            Open the Supabase SQL Editor and run{" "}
            <code>
              supabase/migrations/001_beta_foundation.sql
            </code>.
          </li>
          <li>
            Copy <code>.env.example</code> to{" "}
            <code>.env.local</code>.
          </li>
          <li>
            Add the project URL and publishable key.
          </li>
          <li>
            Restart <code>npm run dev</code> and reopen
            this page.
          </li>
        </ol>

        <p className="beta-security-note">
          Never place a Supabase service-role key in Vite,
          browser code, GitHub, or Vercel client-side
          environment variables.
        </p>
      </section>
    </>
  );
}

export default BetaSetup;
