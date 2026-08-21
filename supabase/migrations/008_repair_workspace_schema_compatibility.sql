-- Crash Ops Pro
-- Bring databases created from the original beta foundation up to the
-- complete repair-workspace shape expected by the application.

begin;

alter table public.repair_orders
  add column if not exists technician text,
  add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';

commit;
