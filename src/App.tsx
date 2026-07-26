import "./App.css";

type ShopStatus = "On Track" | "Watch" | "Overloaded";

type Shop = {
  name: string;
  vehicles: number;
  laborHours: number;
  cycleTime: number;
  status: ShopStatus;
};

const shops: Shop[] = [
  {
    name: "Monroeville",
    vehicles: 32,
    laborHours: 986,
    cycleTime: 13.2,
    status: "Watch",
  },
  {
    name: "Greensburg",
    vehicles: 28,
    laborHours: 742,
    cycleTime: 10.8,
    status: "On Track",
  },
  {
    name: "North Hills",
    vehicles: 31,
    laborHours: 894,
    cycleTime: 11.4,
    status: "On Track",
  },
  {
    name: "North Huntingdon",
    vehicles: 25,
    laborHours: 706,
    cycleTime: 14.1,
    status: "Watch",
  },
  {
    name: "Canonsburg",
    vehicles: 27,
    laborHours: 958,
    cycleTime: 17.6,
    status: "Overloaded",
  },
];

const navigationItems = [
  "Dashboard",
  "Production Board",
  "WIP Capacity",
  "Scheduling",
  "Estimating",
  "KPIs",
  "Reports",
  "Administration",
];

function getStatusClass(status: ShopStatus) {
  if (status === "On Track") {
    return "good";
  }

  if (status === "Watch") {
    return "warning";
  }

  return "alert";
}

function App() {
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
              className={index === 0 ? "nav-button active" : "nav-button"}
              key={item}
              type="button"
            >
              <span className="nav-icon">{index + 1}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Crash Ops Consult LLC</p>
          <span>Version 0.1</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">BODY BY COCHRAN</p>
            <h2>Operations Dashboard</h2>
            <p className="page-description">
              Monitor workload, production health, and shop capacity.
            </p>
          </div>

          <div className="header-actions">
            <button className="secondary-button" type="button">
              Export Report
            </button>

            <button className="primary-button" type="button">
              Add Shop
            </button>
          </div>
        </header>

        <section className="cards">
          <article className="card">
            <div className="card-heading">
              <p>Active Shops</p>
              <span className="metric-icon">01</span>
            </div>

            <strong>{shops.length}</strong>
            <small>All locations reporting</small>
          </article>

          <article className="card">
            <div className="card-heading">
              <p>Vehicles in Process</p>
              <span className="metric-icon">02</span>
            </div>

            <strong>{totalVehicles}</strong>
            <small>Across all active shops</small>
          </article>

          <article className="card">
            <div className="card-heading">
              <p>Open Labor Hours</p>
              <span className="metric-icon">03</span>
            </div>

            <strong>{totalLaborHours.toLocaleString()}</strong>
            <small>Current repair workload</small>
          </article>

          <article className="card">
            <div className="card-heading">
              <p>Average Cycle Time</p>
              <span className="metric-icon">04</span>
            </div>

            <strong>{averageCycleTime.toFixed(1)} days</strong>
            <small>Keys-to-keys average</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel shop-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">REGIONAL PERFORMANCE</p>
                <h3>Shop Overview</h3>
              </div>

              <button className="text-button" type="button">
                View all shops
              </button>
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

                  <span
                    className={`status ${getStatusClass(shop.status)}`}
                  >
                    {shop.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <aside className="panel alerts-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">MANAGEMENT FOCUS</p>
                <h3>Operational Alerts</h3>
              </div>
            </div>

            <div className="alert-item critical">
              <span className="alert-dot" />

              <div>
                <strong>Canonsburg overloaded</strong>
                <p>Cycle time is 17.6 days with 958 open labor hours.</p>
              </div>
            </div>

            <div className="alert-item caution">
              <span className="alert-dot" />

              <div>
                <strong>North Huntingdon needs review</strong>
                <p>Cycle time has moved above the regional target.</p>
              </div>
            </div>

            <div className="alert-item positive">
              <span className="alert-dot" />

              <div>
                <strong>Greensburg performing well</strong>
                <p>Workload and cycle time are currently on target.</p>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
