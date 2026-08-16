# Phase 1 — Beta Foundation

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
- Password sign-in, reset, session restoration, and logout
- Protected application shell and missing-configuration screen
- Authenticated user, organization, and role contexts

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_beta_foundation.sql`
   in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable key.
5. Restart the Vite development server.
6. Sign in with a Supabase Auth user and open **Beta Setup**.

## Application access

`AuthProvider` is the single owner of the Supabase session and
subscribes to authentication state changes. The application shell
is not mounted until a persisted session is restored. Password
recovery links switch the auth screen into password-update mode.

After authentication, `ApplicationContextProvider` loads the user's
`profiles` row and associated `organizations` row. It exposes focused
user, organization, and role hooks to the application without changing
any operational intelligence or production workflows.

## Security

The publishable/anon key may be used in browser code only
when RLS is enabled and policies are correct. Never expose the
service-role key in the browser, Vite variables, GitHub, or a
public deployment.

If either browser credential is absent, Crash Ops OS renders a safe
configuration screen rather than creating a partial Supabase client.
