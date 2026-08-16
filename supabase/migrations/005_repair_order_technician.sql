-- Crash Ops OS
-- Persist technician assignments from grouped WIP reports.

begin;

alter table public.repair_orders
  add column if not exists technician text;

create index if not exists repair_orders_shop_technician_idx
  on public.repair_orders(shop_id, technician);

commit;
