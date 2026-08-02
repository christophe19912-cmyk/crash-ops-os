import { useState } from "react";
import "./App.css";
import ImportCenter from "./ImportCenter";
import WipIntelligence from "./WipIntelligence";
import DailyReport from "./DailyReport";
import OperationsEngineTest from "./OperationsEngineTest";

type Page =
  | "Dashboard"
  | "dAIly Report"
  | "Import Center"
  | "Production Board"
  | "WIP Capacity"
  | "Scheduling"
  | "KPIs"
  | "Reports"
  | "Administration";

type ShopStatus = "On Track" | "Watch" | "Overloaded";

type Shop = {
  name: string;
  vehicles: number;
  laborHours: number;
  weeklyOutput: number;
  cycleTime: number;
  touchTime: number;
  scheduledDrops: number;
  deliveriesToday: number;
  status: ShopStatus;
};



const navigationItems: Page[] = [
  "Dashboard",
  "dAIly Report",
  "Import Center",
  "Production Board",
  "WIP Capacity",
  "Scheduling",
  "KPIs",
  "Reports",
  "Administration",
];

const shops: Shop[] = [
  {
    name: "Monroeville",
    vehicles: 32,
    laborHours: 986,
    weeklyOutput: 350,
    cycleTime: 13.2,
    touchTime: 2.2,
    scheduledDrops: 5,
    deliveriesToday: 4,
    status: "Watch",
  },
  {
    name: "Greensburg",
    vehicles: 28,
    laborHours: 742,
    weeklyOutput: 340,
    cycleTime: 10.8,
    touchTime: 3.4,
    scheduledDrops: 4,
    deliveriesToday: 5,
    status: "On Track",
  },
  {
    name: "North Hills",
    vehicles: 31,
    laborHours: 894,
    weeklyOutput: 375,
    cycleTime: 11.4,
    touchTime: 3.1,
    scheduledDrops: 5,
    deliveriesToday: 3,
    status: "On Track",
  },
  {
    name: "North Huntingdon",
    vehicles: 25,
    laborHours: 706,
    weeklyOutput: 290,
    cycleTime: 14.1,
    touchTime: 1.8,
    scheduledDrops: 4,
    deliveriesToday: 2,
    status: "Watch",
  },
  {
    name: "Canonsburg",
    vehicles: 34,
    laborHours: 1210,
    weeklyOutput: 315,
    cycleTime: 17.6,
    touchTime: 1.9,
    scheduledDrops: 6,
    deliveriesToday: 3,
    status: "Overloaded",
  },
];

function getStatusClass(status: ShopStatus) {
  if (status === "On Track") return "good";
  if (status === "Watch") return "warning";
  return "alert";
}

function Dashboard() {
  const totalVehicles = shops.reduce(
    (total, shop) => total + shop.vehicles,
    0,
  );

  const totalLaborHours = shops.reduce(
    (total, shop) => total + shop.laborHours,
    0,
  );

  const averageCycleTime =
    shops.reduce((total, shop) => total + shop.cycleTime, 0) /
    shops.length;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">BODY BY COCHRAN</p>
          <h2>Operations Dashboard</h2>
          <p className="page-description">
            Monitor workload, production health, and shop capacity.
          </p>
        </div>
      </header>

      <section className="cards">
        <article className="card">
          <p>Active Shops</p>
          <strong>{shops.length}</strong>
          <small>All pilot locations reporting</small>
        </article>

        <article className="card">
          <p>Vehicles in Process</p>
          <strong>{totalVehicles}</strong>
          <small>Across all active shops</small>
        </article>

        <article className="card">
          <p>Open Labor Hours</p>
          <strong>{totalLaborHours.toLocaleString()}</strong>
          <small>Total current workload</small>
        </article>

        <article className="card">
          <p>Average Cycle Time</p>
          <strong>{averageCycleTime.toFixed(1)} days</strong>
          <small>Regional keys-to-keys average</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">REGIONAL PERFORMANCE</p>
            <h3>Shop Overview</h3>
          </div>
        </div>

        <div className="shop-table">
          <div className="shop-row shop-row-header">
            <span>Location</span>
            <span>Vehicles</span>
            <span>Labor Hours</span>
            <span>Cycle Time</span>
            <span>Status</span>
          </div>

          {shops.map((shop) => (
            <div className="shop-row" key={shop.name}>
              <strong>{shop.name}</strong>
              <span>{shop.vehicles}</span>
              <span>{shop.laborHours.toLocaleString()}</span>
              <span>{shop.cycleTime.toFixed(1)} days</span>
              <span className={`status ${getStatusClass(shop.status)}`}>
                {shop.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

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
    useState<Page>("Dashboard");

  function renderPage() {
    if (activePage === "Dashboard") {
      return <Dashboard />;
    }

    if (activePage === "dAIly Report") {
      return <DailyReport />;
    }

    if (activePage === "Import Center") {
      return <ImportCenter />;
    }

    if (activePage === "WIP Capacity") {
      return <WipIntelligence />;
    }

    if (activePage === "KPIs") {
      return <OperationsEngineTest />;
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
