# Crash Ops OS — Roadmap

## Vision

Crash Ops OS evolves from an alpha operations dashboard into a unified collision-repair intelligence platform. The central milestone is the **Crash Ops Intelligence Core** — a single evaluation pipeline that produces a shared snapshot consumed by every page.

## Current Alpha

Shipped or in active use:

| Capability | Module | Status |
|------------|--------|--------|
| WIP import (Nexsyis CSV) | Import Center | Implemented |
| Store mapping (shop selection on import) | Import Center | Implemented |
| Mission Control (regional command center) | Mission Control | Implemented |
| dAIly Report (operational action list) | dAIly Report | Implemented |
| WIP Intelligence (workload analytics) | WIP Capacity nav | Implemented |
| Production Board (stage-column view) | Production Board | Foundation |
| Repair / shop health scoring | Operations Engine | Implemented |
| Capacity settings (per-shop configuration) | Administration nav | Implemented |
| Capacity planning (five-day drop plan) | Scheduling nav | Implemented |
| Capacity status embed | CapacityIntegrationPanel | Implemented |
| Stage dictionary | stageDictionary service | Implemented |
| Operational recommendations | Recommendation Engine | Implemented |
| Operations engine debug view | KPIs nav | Dev / validation |
| Reports | Reports nav | Placeholder |

### Alpha limitations

- Data persists in browser localStorage only (no cloud sync or authentication)
- Each page recalculates engines independently (no shared intelligence snapshot)
- Production Board is read-only (no drag-and-drop scheduling)
- Some WIP metrics inconsistently include or exclude C/HLD
- Shop lists and number parsing utilities are duplicated across modules

## Next Phase

### Crash Ops Intelligence Core v1

Unify evaluation into a single snapshot:

- Normalized repair orders
- Repair health and priority (per repair)
- Shop health (per shop)
- Production blockers, parts risk, aging risk, delivery-closeout risk
- Capacity position (status, thresholds, drop recommendations)
- Recommended drop count and severity mix
- Daily action priorities

**Deliverables:**

1. Define an `IntelligenceSnapshot` type aggregating all engine outputs
2. Build a snapshot builder function (React-independent) that runs all evaluations once
3. Migrate pages to consume the snapshot instead of calling engines directly
4. Align C/HLD exclusion across all WIP hour calculations

### Editable scheduling board

- Drag-and-drop repair movement on Production Board
- Persist schedule changes (initially localStorage, later cloud)
- Validate moves against capacity and stage rules

### Technician workload balancing

- Per-technician labor hours in process
- Assignment recommendations based on capacity and skill mix
- Integration with Production Board scheduling

### Estimator workload

- Per-estimator open repair count and labor value
- Blueprint queue visibility and prioritization

### Parts ETA and sourcing risk

- Parts arrival tracking beyond stage code (PO vs BOP)
- ETA-based risk scoring
- Alternate sourcing escalation recommendations

### Blueprint readiness

- Blueprint completion criteria
- Large-repair planning gates before production assignment
- Integration with capacity severity mix

### Bottleneck detection

- Stage-level dwell time analysis
- Identify shops or stages where repairs accumulate
- Automated bottleneck alerts in Mission Control

## Later Phase

| Capability | Description |
|------------|-------------|
| Multi-shop optimization | Cross-location workload balancing and drop allocation |
| Predictive delivery dates | Estimated completion based on stage, parts, and capacity |
| Trend detection | Week-over-week WIP, cycle time, and throughput trends |
| Secure authentication | User accounts, role-based access |
| Cloud persistence | Shared data across devices and locations |
| CCC Secure Share integration | Direct management-system data feeds |
| Other management-system integrations | Beyond Nexsyis CSV import |
| SaaS deployment | Hosted multi-tenant platform |

## Module Maturity

| Module | Maturity | Notes |
|--------|----------|-------|
| Import Center | Production-ready (alpha) | CSV validation, shop mapping |
| Mission Control | Production-ready (alpha) | Regional overview, top priorities |
| dAIly Report | Production-ready (alpha) | Action checklist with completion tracking |
| WIP Intelligence | Production-ready (alpha) | Some metric inconsistencies to resolve |
| Production Board | Foundation | Read-only board; hardcoded columns |
| Capacity Planning | Production-ready (alpha) | Five-day plan with severity mix |
| WIP Capacity Settings | Production-ready (alpha) | Full settings editor with preview |
| Operations Engine | Stable | Core scoring logic complete |
| Capacity Engine | Stable | Four-status evaluation complete |
| Recommendation Engine | Stable | Six recommendation types |
| Stage Dictionary | Stable | Ten defined stages + unknown fallback |
| Intelligence Core | Not started | Target for next phase |
| Reports | Not started | Placeholder navigation item |
| Authentication / Cloud | Not started | Later phase |

## Intelligence Core Migration Order

Suggested page migration sequence when building Intelligence Core v1:

1. **OperationsEngineTest (KPIs)** — validate snapshot output against current engine calls
2. **Mission Control** — highest-value consumer; regional + repair health
3. **dAIly Report** — recommendations from snapshot priorities
4. **Production Board** — repair health from snapshot
5. **WIP Intelligence** — replace component-local aggregation with snapshot metrics
6. **CapacityIntegrationPanel** — capacity section of snapshot
7. **Capacity Planning / WipCapacitySettings** — capacity section of snapshot

Each migration should preserve existing displayed values. Run `npm run build` and visually validate after each step.
