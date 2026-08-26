# Crash Ops Pro — Product Roadmap

## Current Product Direction

Crash Ops Pro is a multi-tenant collision-repair operating system. The current beta connects estimate intake, imported WIP, repair work files, scheduling, production visibility, capacity intelligence, daily action management, parts invoices, and leadership accountability.

The KPI module remains intentionally paused until KPI definitions and authoritative source data are approved.

## Shipped Beta Foundation

| Capability | Status | Notes |
|---|---|---|
| Supabase authentication | Implemented | Password sign-in/reset, session restoration, protected application shell, logout |
| Organization foundation | Implemented | Organizations, centers, users, roles, shop access, and row-level security |
| Nexsyis WIP import | Implemented | Excel/CSV, legacy and technician-grouped layouts, validation and shop matching |
| Persisted WIP repair files | Implemented | Imports upsert canonical repair orders into Supabase |
| Estimate Intake | Implemented | CCC estimate reading, image/file selection, repair creation, schedule handoff |
| Repair Workspace | Implemented | Focused work-file tabs, close/cancel lifecycle, lightweight job costing |
| Parts invoices | Foundation implemented | Master RO invoice workspace and whole-invoice costing schema |
| Intelligence Core | Implemented | Shared repair, shop, capacity, risk, and recommendation snapshot |
| Mission Control | Implemented | Regional operating overview powered by shared intelligence |
| dAIly Report | Implemented | Persistent action workflow with completion and dismissal tracking |
| Leadership | Implemented | Ownership, deadlines, missed actions, timelines, notes, and CSV export |
| Production Board | Implemented foundation | Stage-driven operational view; continue workflow validation |
| WIP & Capacity | Implemented | Workload, technician grouping, capacity status, and recommendations |
| Scheduling | Implemented foundation | Editable five-day drop board with capacity guidance |
| Estimator/Technician Settings | Implemented | Workforce planning inputs; technician KPI calculations remain paused |
| Cross-device operational settings | Implemented in code | Supabase migration 009 must be applied to production |
| Mobile/desktop layouts | Implemented foundation | Continue device-level regression testing |

## Current Sprint Priorities

1. Apply and verify all Supabase migrations through `009_cloud_operational_settings.sql`.
2. Run an end-to-end Repair Lifecycle test: estimate → repair file → scheduling → production → invoices → close/cancel.
3. Validate imported WIP repair-file opening and duplicate/upsert behavior with real Nexsyis reports.
4. Confirm capacity, estimator, technician, and weekly scheduling data remain consistent across two signed-in devices.
5. Finish repair-workspace invoice totals and parts gross-profit reconciliation.
6. Complete phone/tablet navigation and wide-table testing.

## Near-Term Product Work

### Repair Lifecycle Completion

- Maintain one canonical repair-order record across intake, imports, repairs, scheduling, production, and invoices.
- Preserve repair history when imports refresh existing WIP.
- Require Actual Delivery before a repair becomes a completed sale.
- Keep cancellation separate from completed-sale closeout.
- Add clearer lifecycle status and audit visibility.

### Job Costing and Parts

- Attach scanned/photo invoices to any repair order.
- Match parts invoices against parts sales.
- Calculate parts gross profit and surface exceptions.
- Add invoice validation and duplicate detection.

### Reporting

- Historical WIP snapshots and week-over-week trend views.
- Leadership-ready Weekly and Monthly scorecards after metric definitions are approved.
- Exportable operating and financial exception reports.

## Integration Roadmap

| Integration | Current state | Next gate |
|---|---|---|
| Nexsyis | File import active | Expand import history, validation, and reconciliation |
| CCC ONE | Estimate intake active; Secure Share not connected | Complete developer/CIECA/Secure Share requirements and canonical field mapping |
| ProfitNet | Not started | Define export format and build a dedicated adapter after Nexsyis stability |
| QuickBooks | Concept only | Define parts-receiving and gross-profit accounting workflow |
| Enterprise ARMS | Concept only | Define rental-status and rental-cost data access |

## Deliberately Paused

- Technician and shop KPI calculations are not published yet.
- KPI definitions must identify the authoritative source, calculation, time window, exclusions, and accountable role before development resumes.

## Release Standards

Every release must:

1. Build with strict TypeScript and Vite without errors.
2. Preserve tenant isolation and row-level security.
3. Pass estimate, WIP import, repair open/edit, close/cancel, scheduling, and invoice smoke tests.
4. Be checked on desktop and mobile layouts.
5. Include required Supabase migrations and updated documentation.
