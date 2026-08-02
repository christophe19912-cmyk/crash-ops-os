# Crash Ops OS — Business Rules

Collision-repair operational definitions used across Crash Ops OS. These rules govern scoring, capacity, recommendations, and WIP classification. Do not change these definitions without explicit product approval.

## Operational Vocabulary

| Term | Meaning |
|------|---------|
| **C/HLD** | Completed repair waiting for pickup, final authorization, payment, or paperwork. Excluded from active production WIP. |
| **BOP** | Back-ordered parts — repair blocked because required parts are unavailable. |
| **PO** | Parts ordered — repair waiting for ordered parts or parts verification. |
| **Production hold** | Repair stopped in production (HOLD or HLD stage). Requires identified blocker, owner, and next action. |
| **Active production WIP** | Repairs currently in the production pipeline. C/HLD is **not** active production WIP. |
| **Drop** | A new repair scheduled to enter the shop (intake). |

## Stage Dictionary

`src/services/stageDictionary.ts` is the single source of truth for stage meanings.

Each stage definition includes:

- **code** — normalized stage identifier
- **name** — human-readable label
- **category** — Pre-Production, Production, Parts, Parts Blocker, Flow Blocker, Delivery, Unknown
- **blocker** — None, Waiting on Parts, Back Ordered Parts, Production Hold, Delivery Closeout, Unknown
- **countsAsActiveProduction** — whether the repair counts toward active production WIP
- **countsAsCompleted** — whether the repair is treated as completed (delivery closeout)
- **defaultOwner** — suggested responsible role
- **defaultAction** — recommended next step

### Key stage rules

| Stage | Active production? | Blocker | Notes |
|-------|-------------------|---------|-------|
| ARRIVAL | Yes | None | Pre-production check-in |
| BP | Yes | None | Blueprint / repair planning |
| PO | Yes | Waiting on Parts | Parts ordered, not yet arrived |
| BOP | Yes | Back Ordered Parts | Parts unavailable |
| HOLD / HLD | Yes | Production Hold | Requires blocker, owner, next action |
| BODY, PNT, RSSMB | Yes | None | Active production stages |
| C/HLD | **No** | Delivery Closeout | Completed, awaiting release |
| Unknown | Yes (default) | Unknown | Flagged for dictionary review |

Unknown imported stages receive a fallback definition and are scored with an "Unknown stage" penalty in the Operations Engine.

## Active WIP and C/HLD Exclusion

**Rule:** C/HLD repairs are excluded from active production WIP.

**Implementation:**

- `stageDictionary`: C/HLD has `countsAsActiveProduction: false` and `countsAsCompleted: true`
- `isCompletedHold(stage)` returns true for C/HLD
- Capacity engines (`capacityEngine`, `capacityPlanningEngine`, `CapacityIntegrationPanel`) filter out completed holds when calculating hours in process
- Operations Engine `activeRepairCount` uses `countsAsActiveProduction`

**Alpha inconsistency:** WIP Intelligence vehicle/hour totals and the capacity settings preview currently include C/HLD in some aggregate metrics. Capacity evaluation correctly excludes them. When fixing, align all WIP hour calculations to the exclusion rule above.

## Production Holds

A production hold (HOLD or HLD stage) means the repair is stopped in the pipeline.

**Required elements:**

1. **Blocker** — identified reason the repair is stopped (from stage dictionary: "Production Hold")
2. **Owner** — default: GM / Production Manager
3. **Next action** — default: identify the reason, assign an owner, establish the next required action

The Recommendation Engine generates "Resolve production hold" actions with escalating priority based on days onsite (Critical at 10+ days, High otherwise).

## Parts Stages

| Stage | Code | Impact |
|-------|------|--------|
| Parts ordered | PO | Moderate health penalty; waiting on parts verification |
| Back-ordered parts | BOP | Significant health and priority penalty; parts blocker |

BOP repairs receive higher recommendation priority than PO repairs because unavailable parts threaten delivery and technician flow.

## Capacity Evaluation

Capacity must be evaluated using **labor hours in process**, not vehicle count alone. Vehicle count is used for bay pressure but not as the primary load metric.

### Shop capacity settings

Each shop has store-specific settings in `ShopCapacitySettings`:

| Setting | Purpose |
|---------|---------|
| `weeklyLaborOutputTarget` | Expected weekly labor output (hours) |
| `monthlyLaborOutputTarget` | Expected monthly labor output (hours) |
| `productiveWorkdaysPerMonth` | Workdays used for daily output estimate |
| `targetTouchTimeHours` | Target touch time per repair |
| `targetCycleTimeDays` | Target cycle time (days onsite) |
| `healthyWipWeeks` | Weeks of WIP considered healthy |
| `maximumWipWeeks` | Weeks of WIP before true overload |
| `productiveTechnicians` | Technician count (informational) |
| `productiveBays` | Bay count for bay pressure calculation |
| `averageLaborHoursPerDrop` | Average hours per scheduled intake |
| `maximumDailyDrops` | Daily drop limit |
| `schedulingBufferPercent` | Buffer subtracted from weekly output target |

Settings are stored per shop in localStorage and edited via Administration (WipCapacitySettings).

### Capacity statuses

Evaluated in `capacityEngine.ts` in this priority order:

| Status | Condition | Operating guidance |
|--------|-----------|-------------------|
| **True Overload** | Hours in process > maximum WIP hours | Reduce/reschedule drops; protect deliveries |
| **Flow Delay** | Cycle time above target AND touch time below target (when data available) | WIP walk to remove stage, parts, assignment, or approval blockers |
| **Capture Keys** | Hours in process < 80% of healthy WIP target | Capacity available; add appropriately sized drops |
| **Healthy** | Within healthy range | Maintain current scheduling pace |

### Drop recommendations

Recommended daily drops are calculated from available capacity hours divided by average hours per drop, capped by `maximumDailyDrops`. Severity mix (Light / Medium / Heavy) is planned by the Capacity Planning Engine.

## Scoring and Risk

### Operations Engine scoring philosophy

- **Explainable rules preferred over opaque scoring**
- Each score adjustment includes a label, point value, and explanation
- Health score starts at 100 and is reduced by risk factors
- Priority score accumulates from urgency factors

### Risk levels (health score)

| Score range | Risk level |
|-------------|------------|
| 0–39 | Critical |
| 40–59 | High |
| 60–79 | Medium |
| 80–100 | Low |

### Key health penalties

- Production hold: −22
- Back-ordered parts: −20
- Parts ordered: −8
- Delivery closeout (C/HLD onsite): −6
- Missing technician (active production): −10
- Missing estimator (active production): −7
- Aging: −5 to −25 based on days onsite (10, 14, 20, 30+ day thresholds)
- Large blueprint (BP, 35+ hours): −12
- Unknown stage: −8

### Key priority boosts

- Production blocker: +28
- Parts blocker (BOP): +25
- Completed onsite (C/HLD): +12
- Days onsite: up to +25
- Labor hours: +7 to +20 by size tier
- Repair value: +8 to +15 by pre-tax total tier
- No technician assigned: +10

## Recommendations

The Recommendation Engine (`recommendationEngine.ts`) produces operational actions for the dAIly Report. Each recommendation must answer:

1. **What is wrong?** — title and reason
2. **Why does it matter?** — reason text with operational context
3. **What should happen next?** — action text

When possible, recommendations include a **suggested owner** (from stage dictionary defaults or role-based assignment).

### Recommendation types (alpha)

| Trigger | Title | Priority escalation |
|---------|-------|---------------------|
| Production hold | Resolve production hold | Critical at 10+ days onsite |
| BOP | Escalate back-ordered parts | Critical at 14+ days onsite |
| C/HLD | Complete delivery closeout | High at 20+ days onsite |
| BP with 35+ hours | Prioritize large blueprint | High |
| Unassigned technician | Assign repair ownership | Medium |
| 20+ days onsite (active, not hold/BOP) | Review aging active repair | High |

## Import Mapping

Nexsyis WIP CSV columns mapped by `normalizeRepairOrders()`:

| Nexsyis column | RepairOrder field |
|----------------|-------------------|
| `Crash Ops Shop` or `Loc Code` | `shop` |
| `Folder` | `roNumber` |
| `Customer` | `customer` |
| `Vehicle` | `vehicle` |
| `Repair Stage` | `stage` |
| `Total Labor Hours` | `laborHours` |
| `Pre Tax Total` | `preTaxTotal` |
| `Sales Resource` | `estimator` |
| `Service Resource` | `technician` |
| `Insurance` | `insurance` |
| `Created Date` | `createdDate` |
| `Arrival Date` | `arrivalDate` |
| `Completed Date` | `completedDate` |
| `Vehicle Center Tab` | `vehicleStatus` |

During import, the user selects a target shop. Import Center validates required columns and row-level data before writing to localStorage.

## Supported Shops (Alpha)

- Monroeville
- Greensburg
- North Hills
- North Huntingdon
- Canonsburg

Shop lists are defined in `SHOP_OPTIONS` (`capacitySettings.ts`) and duplicated in `ImportCenter.tsx`. Keep both in sync when adding shops.
