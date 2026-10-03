-- TUGON migration 002 — database-backed read models
-- Apply with: supabase db push
--
-- Purpose: every number, list, chart series, and label rendered by the web
-- operations workspace and the Flutter resident app is produced by PostgreSQL
-- from live tables. This removes the last reason for clients to carry sample
-- data. This migration inserts NO operational rows: no incidents, tickets,
-- users, responders, notifications, announcements, feedback, or logs.

-- ---------------------------------------------------------------------------
-- 1. Configuration readers
--    Operational behaviour reads its constants from public.system_settings so an
--    administrator can change them in the database without a code deployment.
-- ---------------------------------------------------------------------------
create or replace function public.setting_value(p_key text, p_default text default null)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif((select s.value #>> '{}' from public.system_settings s where s.key = p_key), ''),
    p_default
  );
$$;

create or replace function public.setting_number(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif((select s.value #>> '{}' from public.system_settings s where s.key = p_key), '')::integer,
    p_default
  );
$$;

create or replace function public.ops_timezone()
returns text language sql stable security definer set search_path = public as $$
  select public.setting_value('default_timezone', 'Asia/Manila');
$$;

create or replace function public.ticket_prefix()
returns text language sql stable security definer set search_path = public as $$
  select public.setting_value('ticket_prefix', 'TGN');
$$;

create or replace function public.max_incident_photos()
returns integer language sql stable security definer set search_path = public as $$
  select public.setting_number('max_incident_photos', 5);
$$;

/** Start of the operations day (local municipal timezone) shifted by p_offset_days. */
create or replace function public.ops_day_start(p_offset_days integer default 0)
returns timestamptz language sql stable security definer set search_path = public as $$
  select (
    date_trunc('day', now() at time zone public.ops_timezone())
    + (coalesce(p_offset_days, 0) * interval '1 day')
  ) at time zone public.ops_timezone();
$$;

-- The ticket generator now takes its prefix and its reporting day from the
-- database instead of literals baked into the function body.
create or replace function public.create_incident_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tickets (incident_id, ticket_number, created_by)
  values (
    new.id,
    public.ticket_prefix() || '-'
      || to_char(new.reported_at at time zone public.ops_timezone(), 'YYYYMMDD')
      || '-'
      || lpad(nextval('public.ticket_number_seq')::text, 4, '0'),
    new.reporter_id
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Incident type vocabulary
--    The resident report form and the workspace filters read their allowed
--    incident types from this table rather than from a list in client source.
--    Reference vocabulary only — it holds no incident records.
-- ---------------------------------------------------------------------------
create table if not exists public.incident_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (char_length(label) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.incident_types enable row level security;
drop policy if exists incident_types_read on public.incident_types;
create policy incident_types_read on public.incident_types for select using (auth.uid() is not null);
drop policy if exists incident_types_staff_write on public.incident_types;
create policy incident_types_staff_write on public.incident_types for all
  using (public.current_user_role() in ('staff', 'admin', 'department_head'))
  with check (public.current_user_role() in ('staff', 'admin', 'department_head'));
drop trigger if exists incident_types_updated_at on public.incident_types;
create trigger incident_types_updated_at before update on public.incident_types
  for each row execute function public.set_updated_at();
create index if not exists incident_types_active_idx on public.incident_types(is_active, sort_order);

do $$
begin
  alter publication supabase_realtime add table public.incident_types;
exception when duplicate_object then null;
end $$;

create or replace function public.active_incident_types()
returns table(id uuid, label text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select t.id, t.label, t.sort_order
  from public.incident_types t
  where t.is_active = true
  order by t.sort_order, t.label;
$$;

-- ---------------------------------------------------------------------------
-- 3. Analytics read models
-- ---------------------------------------------------------------------------

/** KPI card values plus a real period-over-period comparison window. */
drop function if exists public.analytics_summary();
create or replace function public.analytics_summary(p_days integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with bounds as (select greatest(1, least(coalesce(p_days, 30), 365)) as days),
  window_start as (select public.ops_day_start(-1 * ((select days from bounds) - 1)) as ts),
  previous_start as (
    select (select ts from window_start) - ((select days from bounds) * interval '1 day') as ts
  )
  select jsonb_build_object(
    'period_days', (select days from bounds),
    'total_incidents', (select count(*) from public.incidents),
    'pending_verification', (select count(*) from public.incidents where status = 'pending'),
    'active_responses', (select count(*) from public.incidents where status = 'responding'),
    'verified_open', (select count(*) from public.incidents where status = 'verified'),
    'resolved_today', (
      select count(*) from public.incidents
      where status in ('resolved', 'closed')
        and resolved_at >= public.ops_day_start(0)
    ),
    'critical_incidents', (
      select count(*) from public.incidents
      where priority = 'critical' and status not in ('resolved', 'closed', 'rejected')
    ),
    'period_reports', (
      select count(*) from public.incidents where reported_at >= (select ts from window_start)
    ),
    'period_reports_previous', (
      select count(*) from public.incidents
      where reported_at >= (select ts from previous_start)
        and reported_at < (select ts from window_start)
    ),
    'period_resolved', (
      select count(*) from public.incidents
      where resolved_at is not null and resolved_at >= (select ts from window_start)
    ),
    'period_resolved_previous', (
      select count(*) from public.incidents
      where resolved_at is not null
        and resolved_at >= (select ts from previous_start)
        and resolved_at < (select ts from window_start)
    ),
    'incidents_this_month', (
      select count(*) from public.incidents
      where reported_at >= date_trunc('month', now() at time zone public.ops_timezone()) at time zone public.ops_timezone()
    ),
    'resolution_rate', (
      select case
        when count(*) filter (where status <> 'pending') = 0 then 0
        else round(100.0 * count(*) filter (where status in ('resolved', 'closed'))
             / count(*) filter (where status <> 'pending'), 1)
      end from public.incidents
    ),
    'median_response_minutes', (
      select coalesce(round((percentile_cont(0.5) within group (
        order by extract(epoch from (resolved_at - reported_at)) / 60))::numeric, 0), 0)
      from public.incidents where resolved_at is not null
    )
  );
$$;

/** Daily received/resolved series for the dashboard activity chart. */
create or replace function public.analytics_incident_trend(p_days integer default 7)
returns table(day date, reports bigint, resolved bigint)
language sql stable security definer set search_path = public as $$
  with bounds as (select greatest(1, least(coalesce(p_days, 7), 90)) as days),
  days as (
    select (
      date_trunc('day', now() at time zone public.ops_timezone()) - (g * interval '1 day')
    )::date as day
    from generate_series((select days from bounds) - 1, 0, -1) as g
  )
  select
    d.day,
    (select count(*) from public.incidents i
      where (i.reported_at at time zone public.ops_timezone())::date = d.day),
    (select count(*) from public.incidents i
      where i.resolved_at is not null
        and (i.resolved_at at time zone public.ops_timezone())::date = d.day)
  from days d
  order by d.day;
$$;

/** Priority distribution across incidents that still need operational attention. */
create or replace function public.analytics_priority_mix()
returns table(priority public.priority_level, total bigint)
language sql stable security definer set search_path = public as $$
  select p.priority, coalesce(c.total, 0)
  from unnest(enum_range(null::public.priority_level)) as p(priority)
  left join lateral (
    select count(*) as total from public.incidents i
    where i.priority = p.priority and i.status not in ('resolved', 'closed', 'rejected')
  ) c on true
  order by array_position(enum_range(null::public.priority_level), p.priority);
$$;

drop function if exists public.analytics_incidents_by_type();
create or replace function public.analytics_incidents_by_type(p_limit integer default 25)
returns table(incident_type text, total bigint)
language sql stable security definer set search_path = public as $$
  select i.incident_type, count(*)
  from public.incidents i
  group by i.incident_type
  order by count(*) desc, i.incident_type
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

drop function if exists public.analytics_incidents_by_barangay();
create or replace function public.analytics_incidents_by_barangay(p_limit integer default 25)
returns table(barangay text, total bigint, critical bigint)
language sql stable security definer set search_path = public as $$
  select i.barangay, count(*), count(*) filter (where i.priority = 'critical')
  from public.incidents i
  group by i.barangay
  order by count(*) desc, i.barangay
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

drop function if exists public.analytics_response_times();
create or replace function public.analytics_response_times(p_days integer default 30)
returns table(day date, median_minutes numeric, resolved bigint)
language sql stable security definer set search_path = public as $$
  select
    (i.reported_at at time zone public.ops_timezone())::date,
    round((percentile_cont(0.5) within group (
      order by extract(epoch from (i.resolved_at - i.reported_at)) / 60))::numeric, 1),
    count(*)
  from public.incidents i
  where i.resolved_at is not null
    and i.reported_at >= public.ops_day_start(-1 * (greatest(1, least(coalesce(p_days, 30), 365)) - 1))
  group by 1
  order by 1 desc;
$$;

/**
 * Readiness, workload, and administrative counters used by the dashboard pulse,
 * tickets, responders, admin, and department-head views.
 */
create or replace function public.analytics_operations_pulse()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'responders_total', (select count(*) from public.responders),
    'responders_available', (select count(*) from public.responders where availability = 'available'),
    'responders_deployed', (select count(*) from public.responders where availability = 'deployed'),
    'responders_standby', (select count(*) from public.responders where availability = 'standby'),
    'responders_offline', (select count(*) from public.responders where availability = 'offline'),
    'responders_checked_in_24h', (
      select count(*) from public.responders
      where last_check_in is not null and last_check_in >= now() - interval '24 hours'
    ),
    'tickets_total', (select count(*) from public.tickets),
    'tickets_open', (select count(*) from public.tickets where status = 'open'),
    'tickets_awaiting_assignment', (
      select count(*) from public.tickets where status = 'open' and assigned_responder_id is null
    ),
    'tickets_in_field', (select count(*) from public.tickets where status in ('assigned', 'in_progress')),
    'tickets_resolved', (select count(*) from public.tickets where status = 'resolved'),
    'tickets_closed', (select count(*) from public.tickets where status = 'closed'),
    'tickets_resolved_this_week', (
      select count(*) from public.tickets
      where status in ('resolved', 'closed') and updated_at >= date_trunc('week', now())
    ),
    'tickets_sla_met', (
      select count(*) from public.tickets t
      join public.incidents i on i.id = t.incident_id
      where t.status in ('resolved', 'closed')
        and i.resolved_at is not null
        and i.resolved_at - i.reported_at <= interval '60 minutes'
    ),
    'tickets_sla_measured', (
      select count(*) from public.tickets t
      join public.incidents i on i.id = t.incident_id
      where t.status in ('resolved', 'closed') and i.resolved_at is not null
    ),
    'incidents_unassigned', (
      select count(*) from public.incidents
      where assigned_responder_id is null and status in ('pending', 'verified', 'responding')
    ),
    'incidents_geolocated', (
      select count(*) from public.incidents where latitude is not null and longitude is not null
    ),
    'users_total', (select count(*) from public.users),
    'users_active', (select count(*) from public.users where is_active),
    'users_deactivated', (select count(*) from public.users where not is_active),
    'users_by_role', (
      select coalesce(jsonb_object_agg(role_counts.role, role_counts.total), '{}'::jsonb)
      from (select u.role::text as role, count(*) as total from public.users u group by u.role) role_counts
    ),
    'audit_events', (select count(*) from public.system_logs),
    'audit_events_24h', (
      select count(*) from public.system_logs where created_at >= now() - interval '24 hours'
    ),
    'feedback_total', (select count(*) from public.feedback),
    'feedback_last_30_days', (
      select count(*) from public.feedback where created_at >= now() - interval '30 days'
    ),
    'feedback_average', (select coalesce(round(avg(rating)::numeric, 1), 0) from public.feedback),
    'announcements_published', (select count(*) from public.announcements where is_published),
    'announcements_drafts', (select count(*) from public.announcements where not is_published),
    'incident_types_active', (select count(*) from public.incident_types where is_active),
    'notification_devices', (select count(*) from public.user_devices),
    'notifications_unread', (select count(*) from public.notifications where read_at is null)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Workspace counters scoped to the signed-in profile
--    Drives the navigation badges and the header identity block, so no count or
--    name is baked into the client bundle.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', public.current_user_role(),
    'is_staff', public.is_staff_or_admin(),
    'attention_incidents', (
      select case
        when public.is_staff_or_admin() then (
          select count(*) from public.incidents
          where status in ('pending', 'verified', 'responding')
        )
        else (
          select count(*) from public.incidents
          where reporter_id = auth.uid() and status in ('pending', 'verified', 'responding')
        )
      end
    ),
    -- Broadcast rows (user_id is null) carry no per-user read state, so the
    -- badge only counts notifications addressed to the signed-in profile.
    'unread_notifications', (
      select count(*) from public.notifications
      where read_at is null and user_id = auth.uid()
    )
  );
$$;
