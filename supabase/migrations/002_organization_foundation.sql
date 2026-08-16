-- Crash Ops OS
-- Phase 1 Beta: Organization onboarding foundation

begin;

alter table public.organizations
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists timezone text not null default 'America/New_York';

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, 'organization')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.bootstrap_organization(
  organization_name text,
  organization_timezone text,
  center_name text,
  center_code text default null
)
returns table (
  organization_id uuid,
  center_id uuid,
  profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_name text;
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(organization_name), '') is null then
    raise exception 'Organization name is required.';
  end if;

  if nullif(trim(center_name), '') is null then
    raise exception 'Center name is required.';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', email)
  into current_email, current_name
  from auth.users
  where id = current_user_id;

  if exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.organization_id is not null
  ) then
    raise exception 'This user already belongs to an organization.';
  end if;

  base_slug := public.slugify(organization_name);
  if base_slug = '' then
    base_slug := 'organization';
  end if;
  candidate_slug := base_slug;

  while exists (
    select 1 from public.organizations o where o.slug = candidate_slug
  ) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.organizations (name, slug, timezone)
  values (trim(organization_name), candidate_slug, coalesce(nullif(trim(organization_timezone), ''), 'America/New_York'))
  returning id into organization_id;

  insert into public.shops (organization_id, name, code, timezone)
  values (organization_id, trim(center_name), nullif(trim(center_code), ''), coalesce(nullif(trim(organization_timezone), ''), 'America/New_York'))
  returning id into center_id;

  insert into public.profiles (id, organization_id, email, full_name, role, is_active)
  values (current_user_id, organization_id, current_email, current_name, 'platform_admin'::public.app_role, true)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = 'platform_admin'::public.app_role,
        is_active = true,
        updated_at = now();

  insert into public.user_shop_access (user_id, shop_id)
  values (current_user_id, center_id)
  on conflict do nothing;

  profile_id := current_user_id;
  return next;
end;
$$;

grant execute on function public.bootstrap_organization(text, text, text, text)
  to authenticated;

commit;
