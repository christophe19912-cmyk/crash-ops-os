import { useMemo, useState } from "react";
import type { ShopCapacitySettings } from "./models/CapacitySettings";
import { evaluateCapacity } from "./engine/capacityEngine";
import {
  SHOP_OPTIONS,
  getCapacitySettings,
  resetCapacitySettings,
  saveCapacitySettings,
} from "./services/capacitySettings";
import {
  loadImportedWip,
  normalizeRepairOrders,
} from "./services/importedData";
import "./WipCapacitySettings.css";

type NumericSettingKey = Exclude<
  keyof ShopCapacitySettings,
  "shop" | "updatedAt"
>;

function WipCapacitySettings() {
  const importedRecord = useMemo(loadImportedWip, []);

  const importedOrders = useMemo(
    () => normalizeRepairOrders(importedRecord),
    [importedRecord],
  );

  const importedShop = importedOrders[0]?.shop;

  const initialShop =
    importedShop && SHOP_OPTIONS.includes(importedShop)
      ? importedShop
      : "North Hills";

  const [selectedShop, setSelectedShop] =
    useState(initialShop);

  const [settings, setSettings] =
    useState<ShopCapacitySettings>(() =>
      getCapacitySettings(initialShop),
    );

  const [savedMessage, setSavedMessage] = useState("");

  const shopOrders = useMemo(
    () =>
      importedOrders.filter(
        (order) => order.shop === selectedShop,
      ),
    [importedOrders, selectedShop],
  );

  const importedHours = shopOrders.reduce(
    (total, order) => total + order.laborHours,
    0,
  );

  const preview = evaluateCapacity(
    {
      hoursInProcess: importedHours,
      vehiclesOnsite: shopOrders.length,
    },
    settings,
  );

  function selectShop(shop: string) {
    setSelectedShop(shop);
    setSettings(getCapacitySettings(shop));
    setSavedMessage("");
  }

  function updateNumericSetting(
    key: NumericSettingKey,
    value: string,
  ) {
    const numericValue = Number(value);

    setSettings((current) => ({
      ...current,
      [key]: Number.isFinite(numericValue)
        ? numericValue
        : 0,
    }));
  }

  function saveSettings() {
    const saved = saveCapacitySettings({
      ...settings,
      shop: selectedShop,
    });

    setSettings(saved);
    setSavedMessage(
      `${selectedShop} capacity settings saved in this browser.`,
    );
  }

  function resetSettings() {
    const reset = resetCapacitySettings(selectedShop);
    setSettings(reset);
    setSavedMessage(
      `${selectedShop} settings restored to the starting defaults.`,
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            ADMINISTRATION · CAPACITY ENGINE
          </p>

          <h2>WIP Capacity Settings</h2>

          <p className="page-description">
            Establish shop-specific output, WIP, staffing, bay, and
            scheduling thresholds used by Crash Ops calculations.
          </p>
        </div>

        <div className="header-actions">
          <select
            className="report-selector"
            onChange={(event) =>
              selectShop(event.target.value)
            }
            value={selectedShop}
          >
            {SHOP_OPTIONS.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="capacity-settings-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">SHOP CONFIGURATION</p>
              <h3>{selectedShop}</h3>
            </div>
          </div>

          <div className="capacity-form-grid">
            <label className="capacity-field">
              <span>Weekly labor output target</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "weeklyLaborOutputTarget",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.weeklyLaborOutputTarget}
              />
              <small>
                Expected completed labor hours in a normal week.
              </small>
            </label>

            <label className="capacity-field">
              <span>Monthly labor output target</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "monthlyLaborOutputTarget",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.monthlyLaborOutputTarget}
              />
              <small>
                Expected completed labor hours in a normal month.
              </small>
            </label>

            <label className="capacity-field">
              <span>Productive workdays per month</span>
              <input
                min="1"
                onChange={(event) =>
                  updateNumericSetting(
                    "productiveWorkdaysPerMonth",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.productiveWorkdaysPerMonth}
              />
            </label>

            <label className="capacity-field">
              <span>Target touch time</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "targetTouchTimeHours",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={settings.targetTouchTimeHours}
              />
              <small>Target labor hours per active repair day.</small>
            </label>

            <label className="capacity-field">
              <span>Target cycle time</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "targetCycleTimeDays",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={settings.targetCycleTimeDays}
              />
              <small>Target keys-to-keys days.</small>
            </label>

            <label className="capacity-field">
              <span>Healthy WIP weeks</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "healthyWipWeeks",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={settings.healthyWipWeeks}
              />
              <small>
                Desired workload measured in weeks of usable output.
              </small>
            </label>

            <label className="capacity-field">
              <span>Maximum WIP weeks</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "maximumWipWeeks",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={settings.maximumWipWeeks}
              />
              <small>
                Workload above this point is classified as True
                Overload.
              </small>
            </label>

            <label className="capacity-field">
              <span>Productive technicians</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "productiveTechnicians",
                    event.target.value,
                  )
                }
                step="0.5"
                type="number"
                value={settings.productiveTechnicians}
              />
            </label>

            <label className="capacity-field">
              <span>Productive bays</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "productiveBays",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.productiveBays}
              />
            </label>

            <label className="capacity-field">
              <span>Average labor hours per drop</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "averageLaborHoursPerDrop",
                    event.target.value,
                  )
                }
                step="0.1"
                type="number"
                value={settings.averageLaborHoursPerDrop}
              />
            </label>

            <label className="capacity-field">
              <span>Maximum daily drops</span>
              <input
                min="0"
                onChange={(event) =>
                  updateNumericSetting(
                    "maximumDailyDrops",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.maximumDailyDrops}
              />
            </label>

            <label className="capacity-field">
              <span>Scheduling buffer</span>
              <input
                min="0"
                max="50"
                onChange={(event) =>
                  updateNumericSetting(
                    "schedulingBufferPercent",
                    event.target.value,
                  )
                }
                step="1"
                type="number"
                value={settings.schedulingBufferPercent}
              />
              <small>
                Output capacity reserved for variation, delays, and
                unplanned work.
              </small>
            </label>
          </div>

          <div className="capacity-settings-actions">
            <button
              className="secondary-button"
              onClick={resetSettings}
              type="button"
            >
              Restore Defaults
            </button>

            <button
              className="primary-button"
              onClick={saveSettings}
              type="button"
            >
              Save Capacity Settings
            </button>
          </div>

          {savedMessage && (
            <div className="capacity-saved-message">
              {savedMessage}
            </div>
          )}
        </article>

        <aside className="panel capacity-preview">
          <div className="panel-header">
            <div>
              <p className="section-label">LIVE PREVIEW</p>
              <h3>Current Imported WIP</h3>
            </div>
          </div>

          <div className="capacity-preview-score">
            <span>Status</span>
            <strong>{preview.status}</strong>
          </div>

          <div className="capacity-preview-grid">
            <div>
              <span>Imported vehicles</span>
              <strong>{shopOrders.length}</strong>
            </div>

            <div>
              <span>Imported labor hours</span>
              <strong>{importedHours.toFixed(1)}</strong>
            </div>

            <div>
              <span>Usable weekly output</span>
              <strong>{preview.usableWeeklyOutput}</strong>
            </div>

            <div>
              <span>Healthy WIP target</span>
              <strong>{preview.targetWipHours} hrs</strong>
            </div>

            <div>
              <span>Maximum WIP threshold</span>
              <strong>{preview.maximumWipHours} hrs</strong>
            </div>

            <div>
              <span>Weeks to clear</span>
              <strong>{preview.weeksToClear}</strong>
            </div>

            <div>
              <span>Workdays to clear</span>
              <strong>{preview.workdaysToClear}</strong>
            </div>

            <div>
              <span>Target load</span>
              <strong>{preview.loadPercent}%</strong>
            </div>

            <div>
              <span>Bay pressure</span>
              <strong>{preview.bayPressure}</strong>
            </div>

            <div>
              <span>Daily labor target</span>
              <strong>{preview.estimatedDailyLaborOutput}</strong>
            </div>

            <div>
              <span>Suggested daily drops</span>
              <strong>{preview.recommendedDailyDrops}</strong>
            </div>
          </div>

          <div className="wip-recommendation">
            <span>Current recommendation</span>
            <p>{preview.recommendation}</p>
          </div>
        </aside>
      </section>
    </>
  );
}

export default WipCapacitySettings;
