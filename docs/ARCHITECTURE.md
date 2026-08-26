# Crash Ops OS — Architecture

## Product Purpose

Crash Ops OS helps collision-repair managers, general managers, regional leaders, and owners understand current WIP, identify operational risk, plan capacity, prioritize repair orders, and decide what actions to take each day.

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript |
| Build | Vite 8 |
| CSV import | PapaParse |
| Persistence | Supabase/Postgres with local browser cache for resilient reads |
| Authentication | Supabase Auth with organization and shop-scoped access |
| Routing | State-driven navigation in `App.tsx` (no React Router) |

## Directory Layout

```
src/
├── models/           Shared data types (RepairOrder, CapacitySettings)
├── engine/           React-independent business calculation modules
├── services/         Data access, normalization, stage dictionary, recommendations
├── *.tsx             Page components and shared UI panels
├── App.tsx           Shell, sidebar navigation, page routing
└── main.tsx          Application entry point
```

## Module Map

Navigation labels in the sidebar do not always match internal file names. Use this table when locating code.

| Sidebar label | Component | Primary engines / services |
|---------------|-----------|----------------------------|
| Dashboard | `MissionControl.tsx` | Shared Intelligence Core, capacity, risk, recommendations |
| Repairs | `RepairWorkspace.tsx` | Supabase repair work files, lifecycle, job costing |
| Parts Invoices | `PartsInvoices.tsx` | Repair-order invoice workspace |
| AI Intake | `EstimateIntake.tsx` | Estimate reader, repair creation, scheduling handoff |
| Schedule | `SchedulingBoard.tsx` | Capacity-aware weekly scheduling with cloud persistence |
| Production | `ProductionBoard.tsx` | Shared Intelligence Core and stage dictionary |
| WIP & Capacity | `WipIntelligence.tsx` | Imported WIP, technician grouping, capacity intelligence |
| dAIly Report | `DailyReport.tsx` | Persistent operational action workflow |
| Leadership | `LeadershipDashboard.tsx` | Accountability, audit history, CSV export |
| Estimator Load | `EstimatorLoadDashboard.tsx` | Estimator workload engine |
| Import Center | `ImportCenter.tsx` | Excel/CSV parsing, local cache, Supabase WIP persistence |
| Capacity Settings | `WipCapacitySettings.tsx` | Capacity engine inputs persisted to Supabase |
| Estimator Settings | `EstimatorSettings.tsx` | Estimator planning inputs persisted to Supabase |
| Technician Settings | `TechnicianSettings.tsx` | Technician planning inputs persisted to Supabase; KPIs paused |
| Organization | `OrganizationModule.tsx` | Company, centers, users, and planned integrations |

Shared embed:

| Component | Used by | Purpose |
|-----------|---------|---------|
| `CapacityIntegrationPanel.tsx` | Mission Control, dAIly Report, WIP Intelligence | Per-shop capacity status, metrics, and drop recommendations |

## Data Flow

```
Nexsyis WIP Excel/CSV or CCC Estimate Intake
      │
      ▼
Import/Intake  ──►  Supabase repair_orders + import history
      │                    │
      └──► local cache     └──► Repair Workspace / Parts / Scheduling
      │
      ▼
normalizeRepairOrders()  ──►  RepairOrder[]
      │
      ├──► operationsEngine     (health, risk, priority)
      ├──► capacityEngine       (status, thresholds, drops)
      ├──► capacityPlanningEngine  (five-day plan, severity mix)
      └──► recommendationEngine    (daily operational actions)
      │
      ▼
Page components (display only)
```

Capacity settings follow a parallel path:

```
Settings screens  ──►  Supabase settings tables + local cache
      │
      ▼
getCapacitySettings(shop)  ──►  capacityEngine / capacityPlanningEngine
```

## Engine Responsibilities

### Operations Engine (`src/engine/operationsEngine.ts`)

Calculates repair and shop health independent of React.

- `evaluateRepair()` — health score, priority score, risk level, explainable reasons, suggested owner and next action
- `evaluateShop()` — shop-level aggregates, top priorities, concentration signals
- `evaluateAllShops()` — regional view sorted by shop health

Uses `stageDictionary` for stage classification and `importedData.daysSince` for aging.

### Capacity Engine (`src/engine/capacityEngine.ts`)

Evaluates workload against store-specific settings.

- Input: labor hours in process, vehicles onsite, optional cycle/touch time
- Output: weeks to clear, target/max WIP hours, load percent, bay pressure, recommended daily drops, capacity status, operating recommendation

Capacity statuses: **Capture Keys**, **Healthy**, **Flow Delay**, **True Overload**.

### Capacity Planning Engine (`src/engine/capacityPlanningEngine.ts`)

Builds a five-day drop and severity plan.

- Excludes C/HLD from active WIP hours
- Classifies repairs as Light / Medium / Heavy by labor hours
- Projects WIP position day-by-day using `evaluateCapacity`

### Recommendation Engine (`src/services/recommendationEngine.ts`)

Produces explainable operational actions for the dAIly Report.

- Each recommendation answers: what is wrong, why it matters, what should happen next
- Includes suggested owner and blocker where applicable
- Sorted by operational priority

### Stage Dictionary (`src/services/stageDictionary.ts`)

Single source of truth for imported production-stage meanings.

- Stage code, name, category, blocker type
- `countsAsActiveProduction` and `countsAsCompleted` flags
- Default owner and default action per stage
- Helper functions: `isProductionHold`, `isBackOrderedParts`, `isPartsOrdered`, `isCompletedHold`, `isBlockedRepair`

## Shared Data Model

`RepairOrder` (`src/models/RepairOrder.ts`) is the operational unit shared across all modules:

| Field | Source (Nexsyis import) |
|-------|-------------------------|
| `shop` | `Crash Ops Shop` or `Loc Code` |
| `roNumber` | `Folder` |
| `stage` | `Repair Stage` |
| `laborHours` | `Total Labor Hours` |
| `preTaxTotal` | `Pre Tax Total` |
| `estimator` | `Sales Resource` |
| `technician` | `Service Resource` |
| `arrivalDate` | `Arrival Date` |
| … | See `normalizeRepairOrders()` in `importedData.ts` |

## Architecture Principles

1. **React components display and collect input.** They call engines/services; they do not own business rules.
2. **Never duplicate normalization, capacity, stage, scoring, or recommendation logic.**
3. **RepairOrder is the shared operational data model.**
4. **Stage Dictionary is the single source of truth for stage meanings.**
5. **Store settings are store-specific** (`ShopCapacitySettings` per shop).
6. **Engines remain independent of React.**
7. **TypeScript must compile with zero errors** (`npm run build`).
8. **Avoid unused imports and declarations.**
9. **Prefer focused modules under ~300 lines** when practical; do not rewrite large files unless necessary.
10. **Preserve working behavior while refactoring.**

## Crash Ops Intelligence Core v1

The implemented shared snapshot provides:

- Normalized repair orders
- Repair health and priority
- Shop health
- Production blockers, parts risk, aging risk, delivery-closeout risk
- Capacity position
- Recommended drop count and severity mix
- Daily action priorities

Mission Control, Production Board, WIP Intelligence, Scheduling, and dAIly Report consume this shared evaluation path. New operational views must use the same core rather than introducing parallel calculations.

## Persistence Keys

| Key | Content | Written by |
|-----|---------|------------|
| `crashOpsLastWipImport` | Raw imported WIP record (rows + metadata) | Import Center |
| `crashOpsCapacitySettings` | Per-shop `ShopCapacitySettings` objects | WipCapacitySettings (Administration) |
| `crashOpsEstimatorSettings` | Cached estimator settings | Estimator Settings |
| `crashOpsTechnicianSettings` | Cached technician settings | Technician Settings |
| `crashOpsScheduledDrops` | Cached current-week schedule | Scheduling Board |

## Known Structural Debt (Alpha)

These are documented gaps — not blockers for alpha, but patterns to avoid extending:

| Gap | Detail |
|-----|--------|
| Local cache reactivity | Some views initialize from cached WIP and require a refresh after a new import |
| Schema rollout | Application code and Supabase migrations must be deployed together |
| Source-of-truth mapping | Nexsyis, CCC ONE, and future ProfitNet fields need one canonical adapter contract |
| Hardcoded board columns | `ProductionBoard.tsx` stage column map parallels `stageDictionary.ts` |
| Large files | Several components exceed 300 lines (Production Board, WIP Intelligence, Import Center, Mission Control) |

When refactoring these areas, consolidate into the owning engine or service — do not add parallel implementations.
