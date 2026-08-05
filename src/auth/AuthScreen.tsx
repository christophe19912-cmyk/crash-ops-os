import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

type View = "login" | "forgot" | "update";

export default function AuthScreen() {
  const { passwordRecovery, clearPasswordRecovery } = useAuth();
  const [view, setView] = useState<View>(passwordRecovery ? "update" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeView = (next: View) => {
    setView(next);
    setError("");
    setMessage("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (view === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else if (view === "forgot") {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetError) throw resetError;
        setMessage("Check your inbox for a secure password reset link.");
      } else {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        clearPasswordRecovery();
        setMessage("Password updated. You can continue to Crash Ops OS.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-showcase">
        <div className="auth-brand"><span>CO</span><strong>Crash Ops OS</strong></div>
        <div className="auth-promise">
          <p>COLLISION OPERATIONS, UNIFIED</p>
          <h1>Turn shop data into confident daily action.</h1>
          <span>Secure operations intelligence for collision repair leaders and their teams.</span>
        </div>
        <footer>Operational clarity. Every shop. Every day.</footer>
      </section>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-mobile-brand"><span>CO</span> Crash Ops OS</div>
          <p className="auth-eyebrow">SECURE WORKSPACE</p>
          <h2>{view === "login" ? "Welcome back" : view === "forgot" ? "Reset your password" : "Choose a new password"}</h2>
          <p className="auth-description">
            {view === "login" ? "Sign in to access your organization’s operating workspace." : view === "forgot" ? "Enter your work email and we’ll send you a secure reset link." : "Create a strong password to protect your account."}
          </p>

          {view !== "update" && <label>Work email<input autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required type="email" value={email} /></label>}
          {view !== "forgot" && <label>{view === "login" ? "Password" : "New password"}<input autoComplete={view === "login" ? "current-password" : "new-password"} minLength={view === "update" ? 8 : undefined} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required type="password" value={password} /></label>}
          {view === "update" && <label>Confirm new password<input autoComplete="new-password" minLength={8} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required type="password" value={confirmPassword} /></label>}

          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}
          <button className="auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : view === "login" ? "Sign in" : view === "forgot" ? "Send reset link" : "Update password"}</button>

          {view === "login" ? <button className="auth-link" onClick={() => changeView("forgot")} type="button">Forgot your password?</button> : view === "forgot" ? <button className="auth-link" onClick={() => changeView("login")} type="button">Back to sign in</button> : null}
          <p className="auth-help">Need access? Contact your Crash Ops administrator.</p>
        </form>
      </main>
    </div>
  );
}
