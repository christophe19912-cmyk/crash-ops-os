-- Crash Ops OS
-- Persistent repair-order history and leadership action execution

begin;

alter table public.wip_imports
  add column if not exists validation_summary jsonb not null default '{}'::jsonb;

alter table public.repair_orders
  add column if not exists source text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.repair_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  event_type text not null,
  old_value text,
  new_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  repair_order_id uuid references public.repair_orders(id) on delete set null,
  source_key text,
  title text not null,
  description text not null default '',
  action_type text not null,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  assigned_to uuid references public.profiles(id) on delete set null,
  source text not null,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'dismissed', 'missed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  dismissal_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.action_item_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  event_type text not null,
  old_value text,
  new_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists action_items_shop_source_key_uidx
  on public.action_items(shop_id, source_key);
create index if not exists repair_order_events_timeline_idx
  on public.repair_order_events(repair_order_id, created_at desc);
create index if not exists action_items_shop_status_idx
  on public.action_items(shop_id, status, priority, due_at);
create index if not exists action_item_events_timeline_idx
  on public.action_item_events(action_item_id, created_at desc);

alter table public.repair_order_events enable row level security;
alter table public.action_items enable row level security;
alter table public.action_item_events enable row level security;

drop policy if exists "repair_order_events_shop_access" on public.repair_order_events;
create policy "repair_order_events_shop_access" on public.repair_order_events
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id) and
  (public.is_platform_admin() or organization_id = public.current_organization_id()));

drop policy if exists "action_items_shop_access" on public.action_items;
create policy "action_items_shop_access" on public.action_items
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id) and
  (public.is_platform_admin() or organization_id = public.current_organization_id()));

drop policy if exists "action_item_events_shop_access" on public.action_item_events;
create policy "action_item_events_shop_access" on public.action_item_events
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id) and
  (public.is_platform_admin() or organization_id = public.current_organization_id()));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repair_orders_set_updated_at on public.repair_orders;
create trigger repair_orders_set_updated_at before update on public.repair_orders
for each row execute function public.set_updated_at();

create or replace function public.audit_repair_order_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_name text := 'imported_update';
  previous_value text;
  current_value text;
begin
  if tg_op = 'INSERT' then
    event_name := 'imported';
  elsif old.stage is distinct from new.stage then
    event_name := 'stage_changed';
    previous_value := old.stage;
    current_value := new.stage;
  elsif old.estimator is distinct from new.estimator then
    event_name := 'estimator_changed';
    previous_value := old.estimator;
    current_value := new.estimator;
  elsif old.vehicle_status is distinct from new.vehicle_status then
    event_name := 'production_status_changed';
    previous_value := old.vehicle_status;
    current_value := new.vehicle_status;
  end if;

  insert into public.repair_order_events (
    organization_id, shop_id, repair_order_id, event_type,
    old_value, new_value, metadata, created_by
  ) values (
    new.organization_id, new.shop_id, new.id, event_name,
    previous_value, current_value,
    jsonb_build_object('wip_import_id', new.wip_import_id), auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists repair_orders_audit on public.repair_orders;
create trigger repair_orders_audit after insert or update on public.repair_orders
for each row execute function public.audit_repair_order_change();

drop trigger if exists action_items_set_updated_at on public.action_items;
create trigger action_items_set_updated_at before update on public.action_items
for each row execute function public.set_updated_at();

create or replace function public.audit_action_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'in_progress' then 'started'
      when 'completed' then 'completed'
      when 'dismissed' then 'dismissed'
      when 'missed' then 'marked_missed'
      when 'open' then 'reopened'
      else 'updated'
    end;
  elsif old.assigned_to is distinct from new.assigned_to then
    event_name := 'assigned';
  else
    return new;
  end if;

  insert into public.action_item_events (
    organization_id, shop_id, action_item_id, event_type,
    old_value, new_value, created_by
  ) values (
    new.organization_id, new.shop_id, new.id, event_name,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status, auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists action_items_audit on public.action_items;
create trigger action_items_audit after insert or update on public.action_items
for each row execute function public.audit_action_item_change();

commit;
