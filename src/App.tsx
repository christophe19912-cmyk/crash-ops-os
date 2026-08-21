import { useState } from "react";
import "./App.css";
import ImportCenter from "./ImportCenter";
import WipIntelligence from "./WipIntelligence";
import DailyReport from "./DailyReport";
import MissionControl from "./MissionControl";
import ProductionBoard from "./ProductionBoard";
import WipCapacitySettings from "./WipCapacitySettings";
import SchedulingBoard from "./SchedulingBoard";
import EstimateIntake from "./EstimateIntake";
import EstimatorLoadDashboard from "./EstimatorLoadDashboard";
import EstimatorSettings from "./EstimatorSettings";
import TechnicianSettings from "./TechnicianSettings";
import BetaSetup from "./BetaSetup";
import OrganizationModule from "./OrganizationModule";
import LeadershipDashboard from "./LeadershipDashboard";
import RepairWorkspace from "./RepairWorkspace";
import PartsInvoices from "./PartsInvoices";
import { useAuth } from "./auth/AuthProvider";
import { useApplicationContextStatus, useOrganization, useRole, useUserProfile } from "./auth/ApplicationContext";

type Page =
  | "Mission Control" | "Repairs" | "Parts Invoices" | "Estimate Intake" | "Scheduling" | "Production Board" | "WIP Capacity"
  | "dAIly Report" | "Leadership" | "Estimator Load" | "Import Center" | "Administration"
  | "Estimator Settings" | "Technician Settings" | "Beta Setup"
  | "Organization Company" | "Organization Centers" | "Organization Users" | "Organization Integrations";

type NavigationGroup = { label: string; items: Array<{ page: Page; label: string; icon: string }> };

const navigationGroups: NavigationGroup[] = [
  {
    label: "Command",
    items: [
      { page: "Mission Control", label: "Dashboard", icon: "MC" },
      { page: "Repairs", label: "Repairs", icon: "RP" },
      { page: "Parts Invoices", label: "Parts Invoices", icon: "PI" },
    ],
  },
  {
    label: "Repair Flow",
    items: [
      { page: "Estimate Intake", label: "AI Intake", icon: "AI" },
      { page: "Scheduling", label: "Schedule", icon: "SC" },
      { page: "Production Board", label: "Production", icon: "PB" },
      { page: "WIP Capacity", label: "WIP & Capacity", icon: "WP" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { page: "dAIly Report", label: "dAIly Report", icon: "DR" },
      { page: "Leadership", label: "Leadership", icon: "LD" },
      { page: "Estimator Load", label: "Estimator Load", icon: "EL" },
    ],
  },
  {
    label: "Organization",
    items: [
      { page: "Organization Company", label: "Company", icon: "CO" },
      { page: "Organization Centers", label: "Centers", icon: "CE" },
      { page: "Organization Users", label: "Users", icon: "US" },
      { page: "Organization Integrations", label: "Integrations", icon: "IN" },
    ],
  },
  {
    label: "System",
    items: [
      { page: "Import Center", label: "Import Center", icon: "IM" },
      { page: "Administration", label: "Capacity Settings", icon: "CS" },
      { page: "Estimator Settings", label: "Estimator Settings", icon: "ES" },
      { page: "Technician Settings", label: "Technician Settings", icon: "TS" },
      { page: "Beta Setup", label: "Beta Setup", icon: "BT" },
    ],
  },
];

function App() {
  const { signOut } = useAuth();
  const profile = useUserProfile();
  const organization = useOrganization();
  const role = useRole();
  const contextStatus = useApplicationContextStatus();
  const requestedParams = new URLSearchParams(window.location.search);
  const requestedRepairId = requestedParams.get("ro");
  const [activePage, setActivePage] = useState<Page>(requestedRepairId || requestedParams.get("page") === "repairs" ? "Repairs" : "Mission Control");

  const roleLabel = role
    ? role.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")
    : "Member";

  function renderPage() {
    if (activePage === "Mission Control") return <MissionControl />;
    if (activePage === "Repairs") return <RepairWorkspace initialRepairId={requestedRepairId} />;
    if (activePage === "Parts Invoices") return <PartsInvoices />;
    if (activePage === "Estimate Intake") return <EstimateIntake onScheduled={() => setActivePage("Repairs")} />;
    if (activePage === "Scheduling") return <SchedulingBoard />;
    if (activePage === "Production Board") return <ProductionBoard />;
    if (activePage === "WIP Capacity") return <WipIntelligence />;
    if (activePage === "dAIly Report") return <DailyReport />;
    if (activePage === "Leadership") return <LeadershipDashboard />;
    if (activePage === "Estimator Load") return <EstimatorLoadDashboard />;
    if (activePage === "Import Center") return <ImportCenter />;
    if (activePage === "Administration") return <WipCapacitySettings />;
    if (activePage === "Estimator Settings") return <EstimatorSettings />;
    if (activePage === "Technician Settings") return <TechnicianSettings />;
    if (activePage === "Beta Setup") return <BetaSetup />;
    if (activePage.startsWith("Organization ")) {
      return <OrganizationModule page={activePage.replace("Organization ", "") as "Company" | "Centers" | "Users" | "Integrations"} />;
    }
    return null;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CO</div>
          <div><h1>Crash Ops Pro</h1><p>Operations System</p></div>
        </div>

        <nav className="navigation">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  className={activePage === item.page ? "nav-button active" : "nav-button"}
                  key={item.page}
                  onClick={() => setActivePage(item.page)}
                  type="button"
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="workspace-identity">
            <span className="workspace-avatar">{(profile?.full_name || profile?.email || "U").charAt(0).toUpperCase()}</span>
            <div><p>{profile?.full_name || profile?.email || "Crash Ops User"}</p><span>{organization?.name || roleLabel}</span></div>
          </div>
          <button className="logout-button" onClick={() => void signOut()} type="button">Sign out</button>
          <span className="version-label">Crash Ops Pro · Beta</span>
        </div>
      </aside>

      <main className="main">
        {contextStatus.loading && <div className="context-banner">Loading your organization…</div>}
        {contextStatus.error && <div className="context-banner error">{contextStatus.error} Contact your administrator if this continues.</div>}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
