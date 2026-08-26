# Crash Ops Pro

Crash Ops Pro is a React/TypeScript collision-repair operating system for estimate intake, WIP imports, repair work files, scheduling, production visibility, capacity planning, job costing, and leadership accountability.

## Current Stack

- React 19 + TypeScript
- Vite
- Supabase Auth and Postgres
- Vercel hosting
- PapaParse and SheetJS for Nexsyis CSV/Excel imports

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set the Supabase URL and publishable key.
4. Run the Supabase migrations in numerical order.
5. Start the application with `npm run dev`.

Never place the Supabase service-role key in browser environment variables.

## Required Validation

```bash
npm run build
npm run lint
```

The repository currently has pre-existing whole-repository lint debt in archived backup files and the Estimate Intake API. Changed production files should be linted directly until that cleanup is completed.

## Current Product Decisions

- The KPI module is intentionally absent from navigation until KPI definitions and authoritative source data are approved.
- Supabase is the shared source of truth; browser storage is retained as a local cache for operational continuity.
- Imported WIP and estimate intake must converge on the same canonical repair-order record.
- Closing a repair represents a completed sale; cancelling a repair is a separate lifecycle outcome.

See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).
