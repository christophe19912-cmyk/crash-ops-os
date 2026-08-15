-- Crash Ops OS
-- Leadership accountability audit detail

begin;

create or replace function public.audit_action_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_name text;
  previous_value text;
  current_value text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
    current_value := new.status;
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'in_progress' then 'started'
      when 'completed' then 'completed'
      when 'dismissed' then 'dismissed'
      when 'missed' then 'marked_missed'
      when 'open' then 'reopened'
      else 'updated'
    end;
    previous_value := old.status;
    current_value := new.status;
  elsif old.assigned_to is distinct from new.assigned_to then
    event_name := 'assigned';
    previous_value := old.assigned_to::text;
    current_value := new.assigned_to::text;
  elsif old.due_at is distinct from new.due_at then
    event_name := 'due_date_changed';
    previous_value := old.due_at::text;
    current_value := new.due_at::text;
  elsif old.priority is distinct from new.priority then
    event_name := 'priority_changed';
    previous_value := old.priority;
    current_value := new.priority;
  else
    return new;
  end if;

  insert into public.action_item_events (
    organization_id, shop_id, action_item_id, event_type,
    old_value, new_value, created_by
  ) values (
    new.organization_id, new.shop_id, new.id, event_name,
    previous_value, current_value, auth.uid()
  );
  return new;
end;
$$;

commit;
