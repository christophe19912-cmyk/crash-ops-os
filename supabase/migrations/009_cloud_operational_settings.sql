-- Crash Ops Pro
-- Persist capacity, technician, estimator, and scheduling settings across devices.

begin;

alter table public.capacity_settings
  add column if not exists monthly_labor_output_target numeric(10,2) not null default 1400,
  add column if not exists productive_workdays_per_month numeric(8,2) not null default 20,
  add column if not exists healthy_wip_weeks numeric(8,2) not null default 2.5,
  add column if not exists maximum_wip_weeks numeric(8,2) not null default 3.5,
  add column if not exists average_labor_hours_per_drop numeric(8,2) not null default 34,
  add column if not exists maximum_daily_drops numeric(8,2) not null default 4,
  add column if not exists scheduling_buffer_percent numeric(8,2) not null default 10;

create table if not exists public.technician_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  technician_name text not null,
  role text not null default 'Body Technician',
  weekly_labor_target numeric(8,2) not null default 40,
  weekly_availability_hours numeric(8,2) not null default 40,
  pto_days_this_week numeric(4,2) not null default 0,
  is_active boolean not null default true,
  capacity_adjustment numeric(6,3) not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (shop_id, technician_name)
);

create index if not exists technician_settings_org_shop_idx
  on public.technician_settings(organization_id, shop_id);

alter table public.technician_settings enable row level security;

drop policy if exists "technician_settings_shop_access" on public.technician_settings;
create policy "technician_settings_shop_access"
on public.technician_settings
for all to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id = public.current_organization_id()
  )
);

drop trigger if exists technician_settings_set_updated_at on public.technician_settings;
create trigger technician_settings_set_updated_at
before update on public.technician_settings
for each row execute function public.set_updated_at();

commit;
