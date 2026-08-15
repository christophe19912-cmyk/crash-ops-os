-- Crash Ops OS
-- Action automation and daily operating cadence

begin;

create table if not exists public.action_sla_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  due_hours integer not null check (due_hours > 0),
  escalation_hours integer not null check (escalation_hours >= 0),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, priority)
);

create table if not exists public.daily_leadership_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  brief_date date not null default current_date,
  open_count integer not null default 0,
  in_progress_count integer not null default 0,
  completed_count integer not null default 0,
  missed_count integer not null default 0,
  critical_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  unique (shop_id, brief_date)
);

create table if not exists public.action_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (action_item_id, notification_type)
);

create index if not exists daily_briefs_org_date_idx
  on public.daily_leadership_briefs(organization_id, brief_date desc);
create index if not exists action_notifications_recipient_idx
  on public.action_notifications(recipient_id, read_at, created_at desc);

alter table public.action_sla_rules enable row level security;
alter table public.daily_leadership_briefs enable row level security;
alter table public.action_notifications enable row level security;

create policy "action_sla_rules_org_access" on public.action_sla_rules
for all to authenticated
using (public.is_platform_admin() or organization_id = public.current_organization_id())
with check ((public.is_platform_admin() or organization_id = public.current_organization_id())
  and public.is_organization_admin());

create policy "daily_briefs_shop_access" on public.daily_leadership_briefs
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id) and
  (public.is_platform_admin() or organization_id = public.current_organization_id()));

create policy "action_notifications_select" on public.action_notifications
for select to authenticated
using (public.can_access_shop(shop_id) and
  (recipient_id = auth.uid() or recipient_id is null or public.is_organization_admin()));

create policy "action_notifications_update" on public.action_notifications
for update to authenticated
using (public.can_access_shop(shop_id) and
  (recipient_id = auth.uid() or public.is_organization_admin()))
with check (public.can_access_shop(shop_id));

create policy "action_notifications_insert" on public.action_notifications
for insert to authenticated
with check (public.can_access_shop(shop_id) and
  (public.is_platform_admin() or organization_id = public.current_organization_id()));

create or replace function public.run_daily_action_cadence(requested_shop_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_org uuid := public.current_organization_id();
  affected_due integer := 0;
  affected_missed integer := 0;
  generated_briefs integer := 0;
begin
  if current_org is null and not public.is_platform_admin() then
    raise exception 'An organization profile is required.';
  end if;

  if requested_shop_id is not null and not public.can_access_shop(requested_shop_id) then
    raise exception 'Shop access is required.';
  end if;

  update public.action_items a
  set due_at = a.created_at + make_interval(hours => r.due_hours)
  from public.action_sla_rules r
  where r.organization_id = a.organization_id
    and r.priority = a.priority
    and r.enabled = true
    and a.due_at is null
    and a.status in ('open', 'in_progress')
    and (requested_shop_id is null or a.shop_id = requested_shop_id)
    and public.can_access_shop(a.shop_id);
  get diagnostics affected_due = row_count;

  update public.action_items a
  set status = 'missed'
  where a.status in ('open', 'in_progress')
    and a.due_at < now()
    and (requested_shop_id is null or a.shop_id = requested_shop_id)
    and public.can_access_shop(a.shop_id);
  get diagnostics affected_missed = row_count;

  insert into public.action_notifications (
    organization_id, shop_id, action_item_id, recipient_id,
    notification_type, title, message
  )
  select a.organization_id, a.shop_id, a.id, a.assigned_to,
    'action_missed', 'Action missed: ' || a.title,
    'This action passed its due time and requires leadership review.'
  from public.action_items a
  join public.action_sla_rules r
    on r.organization_id = a.organization_id
   and r.priority = a.priority
   and r.enabled = true
  where a.status = 'missed'
    and now() >= a.due_at + make_interval(hours => r.escalation_hours)
    and (requested_shop_id is null or a.shop_id = requested_shop_id)
    and public.can_access_shop(a.shop_id)
  on conflict (action_item_id, notification_type) do nothing;

  insert into public.daily_leadership_briefs (
    organization_id, shop_id, brief_date, open_count, in_progress_count,
    completed_count, missed_count, critical_count, summary, generated_by, generated_at
  )
  select s.organization_id, s.id, current_date,
    count(a.id) filter (where a.status = 'open'),
    count(a.id) filter (where a.status = 'in_progress'),
    count(a.id) filter (where a.status = 'completed'),
    count(a.id) filter (where a.status = 'missed'),
    count(a.id) filter (where a.priority = 'critical' and a.status not in ('completed', 'dismissed')),
    jsonb_build_object('generated_at', now(), 'dismissed_count', count(a.id) filter (where a.status = 'dismissed')),
    auth.uid(), now()
  from public.shops s
  left join public.action_items a on a.shop_id = s.id
  where (requested_shop_id is null or s.id = requested_shop_id)
    and public.can_access_shop(s.id)
  group by s.organization_id, s.id
  on conflict (shop_id, brief_date) do update set
    open_count = excluded.open_count,
    in_progress_count = excluded.in_progress_count,
    completed_count = excluded.completed_count,
    missed_count = excluded.missed_count,
    critical_count = excluded.critical_count,
    summary = excluded.summary,
    generated_by = excluded.generated_by,
    generated_at = excluded.generated_at;
  get diagnostics generated_briefs = row_count;

  return jsonb_build_object(
    'due_dates_assigned', affected_due,
    'actions_marked_missed', affected_missed,
    'briefs_generated', generated_briefs
  );
end;
$$;

grant execute on function public.run_daily_action_cadence(uuid) to authenticated;

commit;
