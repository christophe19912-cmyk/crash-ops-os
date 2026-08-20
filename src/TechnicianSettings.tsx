import { useMemo, useState } from "react";
import type {
  TechnicianSettings as TechnicianSettingsModel,
} from "./models/TechnicianSettings";
import {
  TECHNICIAN_ROLES,
  seedTechnicianSettings,
  upsertTechnicianSettings,
} from "./services/technicianSettings";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function isAssignedTechnician(name: string) {
  const normalized = name.trim().toLowerCase();
  return (
    normalized !== "" &&
    normalized !== "unassigned" &&
    normalized !== "none" &&
    normalized !== "n/a"
  );
}

function TechnicianSettings() {
  const importedRecord = useMemo(() => loadImportedWip(), []);

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const technicianPairs = useMemo(
    () =>
      Array.from(
        new Map(
          repairOrders
            .filter((order) =>
              isAssignedTechnician(order.technician),
            )
            .map((order) => [
              `${order.shop}::${order.technician.trim()}`,
              {
                shop: order.shop,
                technician: order.technician.trim(),
              },
            ]),
        ).values(),
      ),
    [repairOrders],
  );

  const [settings, setSettings] = useState<
    TechnicianSettingsModel[]
  >(() => seedTechnicianSettings(technicianPairs));

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const shops = Array.from(
    new Set(settings.map((setting) => setting.shop)),
  );

  const visibleSettings =
    selectedShop === "All Locations"
      ? settings
      : settings.filter(
          (setting) => setting.shop === selectedShop,
        );

  function updateSetting(
    current: TechnicianSettingsModel,
    patch: Partial<TechnicianSettingsModel>,
  ) {
    const updated = { ...current, ...patch };
    setSettings((existing) =>
      upsertTechnicianSettings(existing, updated),
    );
  }

  if (!importedRecord || repairOrders.length === 0) {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              ADMINISTRATION · WORKFORCE
            </p>
            <h2>Technician Settings</h2>
            <p className="page-description">
              Configure body-technician availability and production planning inputs.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">TS</div>
          <h3>No imported WIP data found</h3>
          <p>
            Import a technician-grouped WIP report first so body-technician
            names can be discovered and configured.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            ADMINISTRATION · TECHNICIAN CAPACITY
          </p>
          <h2>Technician Settings</h2>
          <p className="page-description">
            Define each body technician’s role, labor target, availability,
            PTO, and planning adjustment.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) =>
              setSelectedShop(event.target.value)
            }
            value={selectedShop}
          >
            <option>All Locations</option>
            {shops.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="panel estimator-settings-note">
        <strong>Planning inputs only</strong>
        <p>
          These settings establish technician capacity assumptions. They do
          not calculate or publish technician KPIs until the KPI definitions
          and source data are approved.
        </p>
      </section>

      {visibleSettings.length === 0 ? (
        <section className="panel daily-empty">
          <div className="ai-mark">TS</div>
          <h3>No assigned body technicians found</h3>
          <p>
            Jobs listed under Unassigned remain visible in WIP Intelligence,
            but no technician profile is created for them.
          </p>
        </section>
      ) : (
        <section className="estimator-settings-grid">
          {visibleSettings.map((setting) => (
            <article
              className="panel estimator-settings-card"
              key={setting.id}
            >
              <div className="estimator-settings-heading">
                <div>
                  <p className="section-label">{setting.shop}</p>
                  <h3>{setting.technician}</h3>
                </div>

                <label className="estimator-active-toggle">
                  <input
                    checked={setting.active}
                    onChange={(event) =>
                      updateSetting(setting, {
                        active: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Active
                </label>
              </div>

              <div className="estimator-settings-form">
                <label>
                  <span>Role</span>
                  <select
                    onChange={(event) =>
                      updateSetting(setting, {
                        role: event.target
                          .value as TechnicianSettingsModel["role"],
                      })
                    }
                    value={setting.role}
                  >
                    {TECHNICIAN_ROLES.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Weekly Labor Target</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      updateSetting(setting, {
                        weeklyLaborTarget:
                          Number(event.target.value) || 0,
                      })
                    }
                    step="0.5"
                    type="number"
                    value={setting.weeklyLaborTarget}
                  />
                </label>

                <label>
                  <span>Weekly Availability Hours</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      updateSetting(setting, {
                        weeklyAvailabilityHours:
                          Number(event.target.value) || 0,
                      })
                    }
                    step="0.5"
                    type="number"
                    value={setting.weeklyAvailabilityHours}
                  />
                </label>

                <label>
                  <span>PTO Days This Week</span>
                  <input
                    max="5"
                    min="0"
                    onChange={(event) =>
                      updateSetting(setting, {
                        ptoDaysThisWeek: Math.min(
                          5,
                          Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        ),
                      })
                    }
                    step="0.5"
                    type="number"
                    value={setting.ptoDaysThisWeek}
                  />
                </label>

                <label>
                  <span>Capacity Adjustment</span>
                  <input
                    max="2"
                    min="0.25"
                    onChange={(event) =>
                      updateSetting(setting, {
                        capacityAdjustment:
                          Number(event.target.value) || 1,
                      })
                    }
                    step="0.05"
                    type="number"
                    value={setting.capacityAdjustment}
                  />
                </label>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

export default TechnicianSettings;
