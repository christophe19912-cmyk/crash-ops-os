# Phase 1A — Supabase Foundation

## Added

- Supabase browser client
- Environment validation
- Beta Setup diagnostics page
- Multi-tenant database migration
- Organizations and shops
- User profiles and roles
- User-to-shop access
- WIP imports and repair orders
- Capacity and estimator settings
- Scheduled drops
- Row Level Security policies

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_beta_foundation.sql`
   in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable key.
5. Restart the Vite development server.
6. Open **Beta Setup** in Crash Ops OS.

## Security

The publishable/anon key may be used in browser code only
when RLS is enabled and policies are correct. Never expose the
service-role key in the browser, Vite variables, GitHub, or a
public deployment.

## Next

Phase 1B will add password authentication, password reset,
session restoration, logout, and protected application access.
