import { useMemo, useState } from "react";
import type {
  EstimatorSettings as EstimatorSettingsModel,
} from "./models/EstimatorSettings";
import {
  ESTIMATOR_ROLES,
  seedEstimatorSettings,
  upsertEstimatorSettings,
} from "./services/estimatorSettings";
import {
  useImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";

function normalizeEstimator(name: string) {
  const trimmed = name.trim();

  if (
    !trimmed ||
    trimmed.toLowerCase() === "unassigned" ||
    trimmed.toLowerCase() === "none" ||
    trimmed.toLowerCase() === "n/a"
  ) {
    return "Unassigned";
  }

  return trimmed;
}

function EstimatorSettings() {
  const importedRecord = useImportedWip();

  const repairOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const estimatorPairs = useMemo(
    () =>
      Array.from(
        new Map(
          repairOrders.map((order) => {
            const estimator = normalizeEstimator(
              order.estimator,
            );

            return [
              `${order.shop}::${estimator}`,
              {
                shop: order.shop,
                estimator,
              },
            ];
          }),
        ).values(),
      ),
    [repairOrders],
  );

  const [settings, setSettings] = useState<
    EstimatorSettingsModel[]
  >(() => seedEstimatorSettings(estimatorPairs));

  const [selectedShop, setSelectedShop] =
    useState("All Locations");

  const shops = Array.from(
    new Set(
      settings.map((setting) => setting.shop),
    ),
  );

  const visibleSettings =
    selectedShop === "All Locations"
      ? settings
      : settings.filter(
          (setting) =>
            setting.shop === selectedShop,
        );

  function updateSetting(
    current: EstimatorSettingsModel,
    patch: Partial<EstimatorSettingsModel>,
  ) {
    const updated = {
      ...current,
      ...patch,
    };

    setSettings((existing) =>
      upsertEstimatorSettings(
        existing,
        updated,
      ),
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
            <h2>Estimator Settings</h2>
            <p className="page-description">
              Configure estimator roles and workload expectations.
            </p>
          </div>
        </header>

        <section className="panel daily-empty">
          <div className="ai-mark">ES</div>
          <h3>No imported WIP data found</h3>
          <p>
            Import a WIP report first so estimator names can be
            discovered and configured.
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
            ADMINISTRATION · ESTIMATOR WORKLOAD
          </p>
          <h2>Estimator Settings</h2>
          <p className="page-description">
            Define role, file capacity, weekly availability, PTO,
            supplement responsibility, and workload adjustment.
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
        <strong>Important</strong>
        <p>
          Supplement responsibility can be configured, but this WIP
          report does not identify supplement-specific work. The
          setting is stored now so future reports or integrations can
          use it accurately.
        </p>
      </section>

      <section className="estimator-settings-grid">
        {visibleSettings.map((setting) => (
          <article
            className="panel estimator-settings-card"
            key={setting.id}
          >
            <div className="estimator-settings-heading">
              <div>
                <p className="section-label">
                  {setting.shop}
                </p>
                <h3>{setting.estimator}</h3>
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
                        .value as EstimatorSettingsModel["role"],
                    })
                  }
                  value={setting.role}
                >
                  {ESTIMATOR_ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Expected File Capacity</span>
                <input
                  min="1"
                  onChange={(event) =>
                    updateSetting(setting, {
                      expectedFileCapacity:
                        Number(event.target.value) ||
                        1,
                    })
                  }
                  type="number"
                  value={setting.expectedFileCapacity}
                />
              </label>

              <label>
                <span>Weekly Availability Hours</span>
                <input
                  min="0"
                  onChange={(event) =>
                    updateSetting(setting, {
                      weeklyAvailabilityHours:
                        Number(event.target.value) ||
                        0,
                    })
                  }
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
                          Number(event.target.value) ||
                            0,
                        ),
                      ),
                    })
                  }
                  type="number"
                  value={setting.ptoDaysThisWeek}
                />
              </label>

              <label>
                <span>Workload Adjustment</span>
                <input
                  max="2"
                  min="0.25"
                  onChange={(event) =>
                    updateSetting(setting, {
                      workloadAdjustment:
                        Number(event.target.value) ||
                        1,
                    })
                  }
                  step="0.05"
                  type="number"
                  value={setting.workloadAdjustment}
                />
              </label>

              <label className="estimator-checkbox-field">
                <input
                  checked={
                    setting.supplementResponsibility
                  }
                  onChange={(event) =>
                    updateSetting(setting, {
                      supplementResponsibility:
                        event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>Supplement responsibility</span>
              </label>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export default EstimatorSettings;
