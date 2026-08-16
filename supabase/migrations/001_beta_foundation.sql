-- Crash Ops OS
-- Phase 1A: Beta security and multi-tenant foundation
-- Run in the Supabase SQL Editor on a new project.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum (
    'platform_admin',
    'organization_admin',
    'regional_manager',
    'shop_manager'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  name text not null,
  code text,
  timezone text not null default 'America/New_York',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,
  organization_id uuid
    references public.organizations(id)
    on delete restrict,
  email text,
  full_name text,
  role public.app_role not null
    default 'shop_manager',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_shop_access (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  shop_id uuid not null
    references public.shops(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table if not exists public.wip_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  shop_id uuid not null
    references public.shops(id)
    on delete cascade,
  imported_by uuid
    references public.profiles(id)
    on delete set null,
  source text not null,
  file_name text not null,
  row_count integer not null default 0,
  status text not null default 'completed',
  imported_at timestamptz not null default now()
);

create table if not exists public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  shop_id uuid not null
    references public.shops(id)
    on delete cascade,
  wip_import_id uuid
    references public.wip_imports(id)
    on delete set null,
  ro_number text not null,
  customer text,
  vehicle text,
  stage text,
  labor_hours numeric(10,2) not null default 0,
  pre_tax_total numeric(12,2) not null default 0,
  estimator text,
  insurance text,
  created_date date,
  arrival_date date,
  completed_date date,
  vehicle_status text,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (shop_id, ro_number)
);

create table if not exists public.capacity_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  shop_id uuid not null unique
    references public.shops(id)
    on delete cascade,
  productive_technicians numeric(8,2) not null default 1,
  weekly_labor_output_target numeric(10,2)
    not null default 0,
  bays numeric(8,2) not null default 1,
  target_touch_time numeric(8,2) not null default 4,
  target_cycle_time_days numeric(8,2)
    not null default 12,
  updated_by uuid
    references public.profiles(id)
    on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.estimator_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  shop_id uuid not null
    references public.shops(id)
    on delete cascade,
  estimator_name text not null,
  role text not null default 'Primary Estimator',
  weekly_availability_hours numeric(8,2)
    not null default 40,
  expected_file_capacity numeric(8,2)
    not null default 20,
  supplement_responsibility boolean
    not null default false,
  pto_days_this_week numeric(4,2)
    not null default 0,
  is_active boolean not null default true,
  workload_adjustment numeric(6,3)
    not null default 1,
  updated_by uuid
    references public.profiles(id)
    on delete set null,
  updated_at timestamptz not null default now(),
  unique (shop_id, estimator_name)
);

create table if not exists public.scheduled_drops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  shop_id uuid not null
    references public.shops(id)
    on delete cascade,
  scheduled_date date not null,
  customer text,
  vehicle text,
  ro_number text,
  estimated_labor_hours numeric(10,2)
    not null default 0,
  severity text,
  notes text,
  created_by uuid
    references public.profiles(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_organization_idx
  on public.shops(organization_id);

create index if not exists profiles_organization_idx
  on public.profiles(organization_id);

create index if not exists user_shop_access_user_idx
  on public.user_shop_access(user_id);

create index if not exists user_shop_access_shop_idx
  on public.user_shop_access(shop_id);

create index if not exists repair_orders_org_shop_idx
  on public.repair_orders(organization_id, shop_id);

create index if not exists wip_imports_org_shop_idx
  on public.wip_imports(organization_id, shop_id);

create index if not exists scheduled_drops_org_shop_idx
  on public.scheduled_drops(organization_id, shop_id);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role()
      = 'platform_admin'::public.app_role,
    false
  )
$$;

create or replace function public.is_organization_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role()
      in (
        'platform_admin'::public.app_role,
        'organization_admin'::public.app_role
      ),
    false
  )
$$;

create or replace function public.can_access_shop(
  requested_shop_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or (
      requested_shop_id in (
        select s.id
        from public.shops s
        where s.organization_id
          = public.current_organization_id()
          and (
            public.current_app_role()
              in (
                'organization_admin'::public.app_role,
                'regional_manager'::public.app_role
              )
            or exists (
              select 1
              from public.user_shop_access usa
              where usa.user_id
                = (select auth.uid())
                and usa.shop_id = s.id
            )
          )
      )
    )
$$;

grant execute on function public.current_profile()
  to authenticated;
grant execute on function public.current_app_role()
  to authenticated;
grant execute on function public.current_organization_id()
  to authenticated;
grant execute on function public.is_platform_admin()
  to authenticated;
grant execute on function public.is_organization_admin()
  to authenticated;
grant execute on function public.can_access_shop(uuid)
  to authenticated;

alter table public.organizations
  enable row level security;
alter table public.shops
  enable row level security;
alter table public.profiles
  enable row level security;
alter table public.user_shop_access
  enable row level security;
alter table public.wip_imports
  enable row level security;
alter table public.repair_orders
  enable row level security;
alter table public.capacity_settings
  enable row level security;
alter table public.estimator_settings
  enable row level security;
alter table public.scheduled_drops
  enable row level security;

create policy "organizations_select"
on public.organizations
for select
to authenticated
using (
  public.is_platform_admin()
  or id = public.current_organization_id()
);

create policy "organizations_admin_write"
on public.organizations
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "shops_select"
on public.shops
for select
to authenticated
using (public.can_access_shop(id));

create policy "shops_admin_write"
on public.shops
for all
to authenticated
using (
  public.is_platform_admin()
  or (
    public.is_organization_admin()
    and organization_id
      = public.current_organization_id()
  )
)
with check (
  public.is_platform_admin()
  or (
    public.is_organization_admin()
    and organization_id
      = public.current_organization_id()
  )
);

create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_platform_admin()
  or (
    public.is_organization_admin()
    and organization_id
      = public.current_organization_id()
  )
);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and organization_id is not distinct from
    public.current_organization_id()
);

create policy "profiles_admin_write"
on public.profiles
for all
to authenticated
using (
  public.is_platform_admin()
  or (
    public.is_organization_admin()
    and organization_id
      = public.current_organization_id()
  )
)
with check (
  public.is_platform_admin()
  or (
    public.is_organization_admin()
    and organization_id
      = public.current_organization_id()
  )
);

create policy "user_shop_access_select"
on public.user_shop_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_platform_admin()
  or public.is_organization_admin()
);

create policy "user_shop_access_admin_write"
on public.user_shop_access
for all
to authenticated
using (
  public.is_platform_admin()
  or public.is_organization_admin()
)
with check (
  public.is_platform_admin()
  or public.is_organization_admin()
);

create policy "wip_imports_shop_access"
on public.wip_imports
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id
      = public.current_organization_id()
  )
);

create policy "repair_orders_shop_access"
on public.repair_orders
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id
      = public.current_organization_id()
  )
);

create policy "capacity_settings_shop_access"
on public.capacity_settings
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id
      = public.current_organization_id()
  )
);

create policy "estimator_settings_shop_access"
on public.estimator_settings
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id
      = public.current_organization_id()
  )
);

create policy "scheduled_drops_shop_access"
on public.scheduled_drops
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (
  public.can_access_shop(shop_id)
  and (
    public.is_platform_admin()
    or organization_id
      = public.current_organization_id()
  )
);

-- Automatically create a minimal profile when a user is
-- created. An administrator must assign organization, role,
-- and shop access before the user can access tenant data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.email
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists
  on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure
  public.handle_new_user();

commit;
