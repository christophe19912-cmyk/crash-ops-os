import { useState } from "react";
import "./App.css";
import ImportCenter from "./ImportCenter";
import WipIntelligence from "./WipIntelligence";
import DailyReport from "./DailyReport";
import MissionControl from "./MissionControl";
import ProductionBoard from "./ProductionBoard";
import IntelligenceDiagnostics from "./IntelligenceDiagnostics";
import WipCapacitySettings from "./WipCapacitySettings";
import SchedulingBoard from "./SchedulingBoard";
import EstimatorLoadDashboard from "./EstimatorLoadDashboard";
import EstimatorSettings from "./EstimatorSettings";
import BetaSetup from "./BetaSetup";

type Page =
  | "Mission Control"
  | "dAIly Report"
  | "Import Center"
  | "Production Board"
  | "WIP Capacity"
  | "Scheduling"
  | "KPIs"
  | "Reports"
  | "Estimator Load"
  | "Estimator Settings"
  | "Beta Setup"
  | "Administration";







const navigationItems: Page[] = [
  "Mission Control",
  "dAIly Report",
  "Import Center",
  "Production Board",
  "WIP Capacity",
  "Scheduling",
  "Estimator Load",
  "KPIs",
  "Reports",
  "Estimator Settings",
  "Beta Setup",
  "Administration",
];





function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">CRASH OPS OS</p>
          <h2>{title}</h2>
          <p className="page-description">
            This module is connected and ready for continued
            development.
          </p>
        </div>
      </header>

      <section className="panel placeholder-panel">
        <h3>{title}</h3>
        <p>
          Navigation is working. This module will be developed after
          the dAIly Report workflow is validated.
        </p>
      </section>
    </>
  );
}

function App() {
  const [activePage, setActivePage] =
    useState<Page>("Mission Control");

  function renderPage() {
    if (activePage === "Mission Control") {
      return <MissionControl />;
    }

    if (activePage === "dAIly Report") {
      return <DailyReport />;
    }

    if (activePage === "Production Board") {
      return <ProductionBoard />;
    }

    if (activePage === "Import Center") {
      return <ImportCenter />;
    }

    if (activePage === "WIP Capacity") {
      return <WipIntelligence />;
    }

    if (activePage === "KPIs") {
      return <IntelligenceDiagnostics />;
    }

    if (activePage === "Estimator Load") {
      return <EstimatorLoadDashboard />;
    }

    if (activePage === "Estimator Settings") {
      return <EstimatorSettings />;
    }

    if (activePage === "Beta Setup") {
      return <BetaSetup />;
    }

    if (activePage === "Administration") {
      return <WipCapacitySettings />;
    }

    if (activePage === "Scheduling") {
      return <SchedulingBoard />;
    }


    return <PlaceholderPage title={activePage} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CO</div>

          <div>
            <h1>Crash Ops</h1>
            <p>Operations System</p>
          </div>
        </div>

        <nav className="navigation">
          {navigationItems.map((item, index) => (
            <button
              className={
                activePage === item
                  ? "nav-button active"
                  : "nav-button"
              }
              key={item}
              onClick={() => setActivePage(item)}
              type="button"
            >
              <span className="nav-icon">
                {item === "dAIly Report" ? "AI" : index + 1}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Crash Ops Consult LLC</p>
          <span>Version 0.4</span>
        </div>
      </aside>

      <main className="main">{renderPage()}</main>
    </div>
  );
}

export default App;
