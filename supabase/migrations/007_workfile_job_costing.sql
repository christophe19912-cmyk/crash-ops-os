-- Crash Ops Pro
-- Lightweight whole-invoice job costing attached to each repair work file.

begin;

create table if not exists public.repair_order_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  category text not null check (category in ('parts', 'sublet', 'paint_materials', 'other')),
  vendor text,
  invoice_number text,
  invoice_date date,
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'ai_scan')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists repair_order_invoices_workfile_idx
  on public.repair_order_invoices(repair_order_id, invoice_date desc);
create index if not exists repair_order_invoices_parts_idx
  on public.repair_order_invoices(repair_order_id, category)
  where category = 'parts';

alter table public.repair_order_invoices enable row level security;

drop policy if exists repair_order_invoices_select on public.repair_order_invoices;
create policy repair_order_invoices_select on public.repair_order_invoices for select to authenticated
  using (public.can_access_shop(shop_id));
drop policy if exists repair_order_invoices_insert on public.repair_order_invoices;
create policy repair_order_invoices_insert on public.repair_order_invoices for insert to authenticated
  with check (public.can_access_shop(shop_id) and organization_id = public.current_organization_id());
drop policy if exists repair_order_invoices_update on public.repair_order_invoices;
create policy repair_order_invoices_update on public.repair_order_invoices for update to authenticated
  using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));

grant select, insert, update on public.repair_order_invoices to authenticated;

commit;
