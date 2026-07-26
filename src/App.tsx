import "./App.css";

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Crash Ops OS</h1>

        <nav>
          <button className="active">Dashboard</button>
          <button>Shops</button>
          <button>Production</button>
          <button>AI Operations</button>
          <button>Administration</button>
        </nav>
      </aside>

      <main className="main">
        <header>
          <div>
            <p className="eyebrow">BODY BY COCHRAN</p>
            <h2>Operations Dashboard</h2>
          </div>

          <button className="primary-button">Add Shop</button>
        </header>

        <section className="cards">
          <article className="card">
            <p>Active Shops</p>
            <strong>5</strong>
          </article>

          <article className="card">
            <p>Vehicles in Process</p>
            <strong>143</strong>
          </article>

          <article className="card">
            <p>Open Labor Hours</p>
            <strong>4,286</strong>
          </article>

          <article className="card">
            <p>Average Cycle Time</p>
            <strong>12.4 days</strong>
          </article>
        </section>

        <section className="panel">
          <h3>Shop Overview</h3>

          <div className="shop-row">
            <span>Monroeville</span>
            <span>32 vehicles</span>
            <span className="status warning">Watch</span>
          </div>

          <div className="shop-row">
            <span>Greensburg</span>
            <span>28 vehicles</span>
            <span className="status good">On Track</span>
          </div>

          <div className="shop-row">
            <span>North Hills</span>
            <span>31 vehicles</span>
            <span className="status good">On Track</span>
          </div>

          <div className="shop-row">
            <span>North Huntingdon</span>
            <span>25 vehicles</span>
            <span className="status warning">Watch</span>
          </div>

          <div className="shop-row">
            <span>Canonsburg</span>
            <span>27 vehicles</span>
            <span className="status alert">Overloaded</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;


