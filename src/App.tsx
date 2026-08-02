import { useMemo, useState } from "react";
import "./App.css";
import ImportCenter from "./ImportCenter";

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

type Recommendation = {
  priority: "High" | "Medium" | "Low";
  shop: string;
  title: string;
  action: string;
  reason: string;
  owner: string;
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

function buildRecommendations(): Recommendation[] {
  const recommendations: Recommendation[] = [];

  shops.forEach((shop) => {
    const weeksToClear = shop.laborHours / shop.weeklyOutput;

    if (weeksToClear >= 3) {
      recommendations.push({
        priority: "High",
        shop: shop.name,
        title: "Reduce incoming repair starts",
        action: `Review the next ${shop.scheduledDrops} scheduled drops. Move heavy repairs or delay non-urgent starts until current WIP declines.`,
        reason: `${shop.laborHours.toLocaleString()} hours are in process against ${shop.weeklyOutput} hours of weekly output, equal to ${weeksToClear.toFixed(1)} weeks of production.`,
        owner: "GM / Scheduler",
      });
    }

    if (shop.cycleTime > 12 && shop.touchTime < 2) {
      recommendations.push({
        priority: "High",
        shop: shop.name,
        title: "Perform a production flow intervention",
        action:
          "Meet with technicians and estimators, identify blocked repairs, and create a same-day movement plan for every stalled vehicle.",
        reason: `Cycle time is ${shop.cycleTime.toFixed(1)} days while touch time is only ${shop.touchTime.toFixed(1)} hours per day.`,
        owner: "GM / Production Manager",
      });
    }

    if (shop.deliveriesToday >= 4) {
      recommendations.push({
        priority: "Medium",
        shop: shop.name,
        title: "Protect today's delivery plan",
        action: `Confirm QC, detail, paperwork, and customer communication for all ${shop.deliveriesToday} planned deliveries before noon.`,
        reason:
          "A high delivery count can create late-day congestion if QC and administrative work are not cleared early.",
        owner: "Production / CSR",
      });
    }

    if (weeksToClear < 2.25 && shop.status === "On Track") {
      recommendations.push({
        priority: "Low",
        shop: shop.name,
        title: "Consider capturing additional keys",
        action:
          "Review available technician and paint capacity and consider adding one or two light-to-medium repairs to the schedule.",
        reason: `Current workload represents approximately ${weeksToClear.toFixed(1)} weeks of production and the shop is operating on target.`,
        owner: "GM / Scheduler",
      });
    }
  });

  return recommendations.sort((a, b) => {
    const score = { High: 3, Medium: 2, Low: 1 };
    return score[b.priority] - score[a.priority];
  });
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

function DailyReport() {
  const [selectedShop, setSelectedShop] = useState("Regional");
  const [generated, setGenerated] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);

  const recommendations = useMemo(() => {
    const allRecommendations = buildRecommendations();

    if (selectedShop === "Regional") {
      return allRecommendations;
    }

    return allRecommendations.filter(
      (recommendation) => recommendation.shop === selectedShop,
    );
  }, [selectedShop]);

  function toggleComplete(index: number) {
    setCompleted((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">ON-DEMAND OPERATIONS INTELLIGENCE</p>
          <h2>dAIly Report</h2>
          <p className="page-description">
            Generate a collision-operations playbook using current
            workload, capacity, cycle time, touch time, deliveries,
            and scheduling pressure.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) => {
              setSelectedShop(event.target.value);
              setGenerated(false);
              setCompleted([]);
            }}
            value={selectedShop}
          >
            <option>Regional</option>
            {shops.map((shop) => (
              <option key={shop.name}>{shop.name}</option>
            ))}
          </select>

          <button
            className="primary-button"
            onClick={() => setGenerated(true)}
            type="button"
          >
            Generate dAIly Report
          </button>
        </div>
      </header>

      {!generated ? (
        <section className="panel daily-empty">
          <div className="ai-mark">AI</div>
          <h3>Ready to analyze operations</h3>
          <p>
            Select the regional group or an individual shop, then
            generate an on-demand task list for today.
          </p>
        </section>
      ) : (
        <>
          <section className="daily-summary-grid">
            <article className="panel daily-summary">
              <p className="section-label">EXECUTIVE SUMMARY</p>
              <h3>{selectedShop} operating plan</h3>
              <p>
                {recommendations.filter((item) => item.priority === "High")
                  .length} high-priority actions,{" "}
                {recommendations.filter((item) => item.priority === "Medium")
                  .length} medium-priority actions, and{" "}
                {recommendations.filter((item) => item.priority === "Low")
                  .length} capacity opportunities were identified.
              </p>
            </article>

            <article className="panel completion-card">
              <span>Tasks completed</span>
              <strong>
                {completed.length} / {recommendations.length}
              </strong>
            </article>
          </section>

          <section className="daily-task-list">
            {recommendations.map((recommendation, index) => (
              <article
                className={
                  completed.includes(index)
                    ? "panel daily-task completed"
                    : "panel daily-task"
                }
                key={`${recommendation.shop}-${recommendation.title}`}
              >
                <div className="daily-task-top">
                  <div>
                    <span
                      className={`priority-badge ${recommendation.priority.toLowerCase()}`}
                    >
                      {recommendation.priority}
                    </span>
                    <span className="shop-badge">
                      {recommendation.shop}
                    </span>
                  </div>

                  <label className="complete-control">
                    <input
                      checked={completed.includes(index)}
                      onChange={() => toggleComplete(index)}
                      type="checkbox"
                    />
                    Complete
                  </label>
                </div>

                <h3>{recommendation.title}</h3>

                <div className="daily-task-grid">
                  <div>
                    <span>Recommended action</span>
                    <p>{recommendation.action}</p>
                  </div>

                  <div>
                    <span>Why this was generated</span>
                    <p>{recommendation.reason}</p>
                  </div>

                  <div>
                    <span>Suggested owner</span>
                    <p>{recommendation.owner}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
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
