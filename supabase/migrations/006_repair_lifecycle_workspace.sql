-- Crash Ops OS
-- Repair-first lifecycle workspace: Scheduled -> Arrived -> WIP -> QC -> Delivered.

begin;

alter table public.repair_orders
  add column if not exists lifecycle_status text not null default 'wip',
  add column if not exists vin text,
  add column if not exists claim_number text,
  add column if not exists workfile_id text,
  add column if not exists scheduled_date date,
  add column if not exists qc_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists lifecycle_notes text;

do $$
begin
  alter table public.repair_orders
    add constraint repair_orders_lifecycle_status_check
    check (lifecycle_status in ('scheduled', 'arrived', 'wip', 'qc', 'delivered'));
exception when duplicate_object then null;
end
$$;

update public.repair_orders
set lifecycle_status = case
  when completed_date is not null then 'delivered'
  when arrival_date is not null then 'wip'
  else 'scheduled'
end
where lifecycle_status = 'wip';

create index if not exists repair_orders_lifecycle_queue_idx
  on public.repair_orders(shop_id, lifecycle_status, scheduled_date, arrival_date);
create index if not exists repair_orders_claim_idx
  on public.repair_orders(organization_id, claim_number)
  where claim_number is not null;
create index if not exists repair_orders_vin_idx
  on public.repair_orders(organization_id, vin)
  where vin is not null;

create or replace function public.lifecycle_rank(value text)
returns integer language sql immutable as $$
  select case value
    when 'scheduled' then 1
    when 'arrived' then 2
    when 'wip' then 3
    when 'qc' then 4
    when 'delivered' then 5
    else 0
  end
$$;

create or replace function public.advance_repair_lifecycle(
  requested_repair_order_id uuid,
  requested_status text
)
returns public.repair_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_record public.repair_orders%rowtype;
  updated_record public.repair_orders%rowtype;
begin
  select * into current_record
  from public.repair_orders
  where id = requested_repair_order_id
  for update;

  if current_record.id is null or not public.can_access_shop(current_record.shop_id) then
    raise exception 'Repair-order access is required.';
  end if;
  if public.lifecycle_rank(requested_status) <> public.lifecycle_rank(current_record.lifecycle_status) + 1 then
    raise exception 'Repairs must advance one lifecycle step at a time.';
  end if;

  update public.repair_orders
  set lifecycle_status = requested_status,
      arrival_date = case when requested_status = 'arrived' then coalesce(arrival_date, current_date) else arrival_date end,
      qc_at = case when requested_status = 'qc' then coalesce(qc_at, now()) else qc_at end,
      delivered_at = case when requested_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      completed_date = case when requested_status = 'delivered' then coalesce(completed_date, current_date) else completed_date end
  where id = requested_repair_order_id
  returning * into updated_record;

  return updated_record;
end;
$$;

grant execute on function public.advance_repair_lifecycle(uuid, text) to authenticated;

create or replace function public.audit_repair_lifecycle_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.lifecycle_status is distinct from new.lifecycle_status then
    insert into public.repair_order_events (
      organization_id, shop_id, repair_order_id, event_type,
      old_value, new_value, metadata, created_by
    ) values (
      new.organization_id, new.shop_id, new.id, 'lifecycle_changed',
      old.lifecycle_status, new.lifecycle_status,
      jsonb_build_object('source', 'repair_workspace'), auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists repair_orders_lifecycle_audit on public.repair_orders;
create trigger repair_orders_lifecycle_audit
after update on public.repair_orders
for each row execute function public.audit_repair_lifecycle_change();

commit;
