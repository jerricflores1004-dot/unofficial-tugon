-- TUGON / Supabase PostgreSQL schema
-- Apply with: supabase db push
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$ begin create type public.user_role as enum ('resident', 'staff', 'admin', 'department_head'); exception when duplicate_object then null; end $$;
do $$ begin create type public.incident_status as enum ('pending', 'verified', 'responding', 'resolved', 'closed', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.priority_level as enum ('critical', 'high', 'medium', 'low'); exception when duplicate_object then null; end $$;
do $$ begin create type public.severity_level as enum ('critical', 'high', 'medium', 'low'); exception when duplicate_object then null; end $$;
do $$ begin create type public.responder_availability as enum ('available', 'deployed', 'standby', 'offline'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_status as enum ('open', 'assigned', 'in_progress', 'resolved', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_type as enum ('report_confirmation', 'status_update', 'emergency_alert', 'announcement'); exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text,
  role public.user_role not null default 'resident',
  barangay text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.responders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lead_name text,
  unit text not null,
  availability public.responder_availability not null default 'available',
  current_location text,
  contact_number text,
  last_check_in timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create sequence if not exists public.ticket_number_seq start 1;
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete restrict,
  incident_type text not null check (char_length(incident_type) between 2 and 80),
  description text not null check (char_length(description) between 10 and 4000),
  location_text text not null,
  barangay text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  severity public.severity_level not null,
  priority public.priority_level not null default 'low',
  status public.incident_status not null default 'pending',
  affected_people integer not null default 0 check (affected_people >= 0),
  vulnerable_groups text[] not null default '{}',
  assigned_responder_id uuid references public.responders(id) on delete set null,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  resolved_at timestamptz,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.incident_photos (
  id uuid primary key default gen_random_uuid(), incident_id uuid not null references public.incidents(id) on delete cascade,
  storage_path text not null unique, original_name text not null, content_type text not null, size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608), uploaded_by uuid not null references public.users(id), created_at timestamptz not null default now()
);
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null unique references public.incidents(id) on delete cascade,
  ticket_number text not null unique,
  assigned_responder_id uuid references public.responders(id) on delete set null,
  status public.ticket_status not null default 'open',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ticket_updates (
  id uuid primary key default gen_random_uuid(), ticket_id uuid references public.tickets(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  update_type text not null default 'internal_note', message text not null check (char_length(message) between 1 and 2000), created_at timestamptz not null default now(),
  constraint ticket_update_parent check (ticket_id is not null or incident_id is not null)
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 2 and 160), body text not null,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')), published_by uuid references public.users(id), is_published boolean not null default false, published_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.users(id) on delete cascade, sender_id uuid references public.users(id) on delete set null,
  title text not null, body text not null, notification_type public.notification_type not null, entity_type text, entity_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade, fcm_token text not null unique, platform text not null check (platform in ('android', 'ios', 'web')), last_seen_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade, incident_id uuid references public.incidents(id) on delete set null, rating integer not null check (rating between 1 and 5), message text check (message is null or char_length(message) <= 2000), created_at timestamptz not null default now()
);
create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.system_settings (
  key text primary key, value jsonb not null default '{}', description text, updated_by uuid references public.users(id) on delete set null, updated_at timestamptz not null default now()
);

create or replace function public.current_user_role() returns public.user_role language sql stable security definer set search_path = public as $$ select role from public.users where id = auth.uid() and is_active = true limit 1 $$;
create or replace function public.is_staff_or_admin() returns boolean language sql stable security definer set search_path = public as $$ select public.current_user_role() in ('staff', 'admin', 'department_head') $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.assign_incident_priority() returns trigger language plpgsql as $$ begin
  if new.severity = 'critical' then new.priority = 'critical';
  elsif new.severity = 'high' and coalesce(array_length(new.vulnerable_groups, 1), 0) > 0 then new.priority = 'critical';
  elsif new.severity = 'high' then new.priority = 'high';
  elsif new.severity = 'medium' then new.priority = 'medium';
  else new.priority = 'low'; end if; return new; end; $$;
create or replace function public.create_incident_ticket() returns trigger language plpgsql security definer set search_path = public as $$ begin
  insert into public.tickets (incident_id, ticket_number, created_by) values (new.id, 'TGN-' || to_char(new.reported_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-' || lpad(nextval('public.ticket_number_seq')::text, 4, '0'), new.reporter_id); return new; end; $$;
create or replace function public.log_incident_change() returns trigger language plpgsql security definer set search_path = public as $$ begin
  insert into public.system_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), TG_OP, 'incident', new.id, jsonb_build_object('status', new.status, 'priority', new.priority)); return new; end; $$;

drop trigger if exists users_updated_at on public.users; create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists responders_updated_at on public.responders; create trigger responders_updated_at before update on public.responders for each row execute function public.set_updated_at();
drop trigger if exists incidents_updated_at on public.incidents; create trigger incidents_updated_at before update on public.incidents for each row execute function public.set_updated_at();
drop trigger if exists incidents_priority on public.incidents; create trigger incidents_priority before insert or update of severity, vulnerable_groups on public.incidents for each row execute function public.assign_incident_priority();
drop trigger if exists incidents_ticket on public.incidents; create trigger incidents_ticket after insert on public.incidents for each row execute function public.create_incident_ticket();
drop trigger if exists incidents_log on public.incidents; create trigger incidents_log after insert or update on public.incidents for each row execute function public.log_incident_change();
drop trigger if exists tickets_updated_at on public.tickets; create trigger tickets_updated_at before update on public.tickets for each row execute function public.set_updated_at();
drop trigger if exists announcements_updated_at on public.announcements; create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
drop trigger if exists settings_updated_at on public.system_settings; create trigger settings_updated_at before update on public.system_settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.users(id, email, full_name, phone) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'phone') on conflict (id) do update set email = excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create index if not exists incidents_status_idx on public.incidents(status); create index if not exists incidents_priority_idx on public.incidents(priority); create index if not exists incidents_reported_at_idx on public.incidents(reported_at desc); create index if not exists incidents_barangay_idx on public.incidents(barangay); create index if not exists incidents_location_search_idx on public.incidents using gin(location_text gin_trgm_ops); create index if not exists incidents_type_search_idx on public.incidents using gin(incident_type gin_trgm_ops); create index if not exists incidents_reporter_idx on public.incidents(reporter_id); create index if not exists incidents_geo_idx on public.incidents(latitude, longitude); create index if not exists tickets_status_idx on public.tickets(status); create index if not exists ticket_updates_ticket_idx on public.ticket_updates(ticket_id, created_at); create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc); create index if not exists logs_created_idx on public.system_logs(created_at desc);

alter table public.users enable row level security; alter table public.responders enable row level security; alter table public.incidents enable row level security; alter table public.incident_photos enable row level security; alter table public.tickets enable row level security; alter table public.ticket_updates enable row level security; alter table public.announcements enable row level security; alter table public.notifications enable row level security; alter table public.user_devices enable row level security; alter table public.feedback enable row level security; alter table public.system_logs enable row level security; alter table public.system_settings enable row level security;

drop policy if exists users_select on public.users; create policy users_select on public.users for select using (id = auth.uid() or public.current_user_role() in ('staff', 'admin', 'department_head'));
drop policy if exists users_update_self on public.users; create policy users_update_self on public.users for update using (id = auth.uid() or public.current_user_role() = 'admin') with check (id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists users_admin_insert on public.users; create policy users_admin_insert on public.users for insert with check (public.current_user_role() = 'admin');
drop policy if exists responders_read on public.responders; create policy responders_read on public.responders for select using (auth.uid() is not null);
drop policy if exists responders_staff_write on public.responders; create policy responders_staff_write on public.responders for all using (public.current_user_role() in ('staff', 'admin')) with check (public.current_user_role() in ('staff', 'admin'));
drop policy if exists incidents_read on public.incidents; create policy incidents_read on public.incidents for select using (reporter_id = auth.uid() or public.is_staff_or_admin());
drop policy if exists incidents_resident_insert on public.incidents; create policy incidents_resident_insert on public.incidents for insert with check (reporter_id = auth.uid() and public.current_user_role() = 'resident');
drop policy if exists incidents_staff_update on public.incidents; create policy incidents_staff_update on public.incidents for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
drop policy if exists incidents_admin_delete on public.incidents; create policy incidents_admin_delete on public.incidents for delete using (public.current_user_role() = 'admin');
drop policy if exists photos_read on public.incident_photos; create policy photos_read on public.incident_photos for select using (exists (select 1 from public.incidents i where i.id = incident_id and (i.reporter_id = auth.uid() or public.is_staff_or_admin())));
drop policy if exists photos_insert on public.incident_photos; create policy photos_insert on public.incident_photos for insert with check (uploaded_by = auth.uid() and exists (select 1 from public.incidents i where i.id = incident_id and (i.reporter_id = auth.uid() or public.is_staff_or_admin())));
drop policy if exists tickets_staff on public.tickets; create policy tickets_staff on public.tickets for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
drop policy if exists tickets_resident_read on public.tickets; create policy tickets_resident_read on public.tickets for select using (exists (select 1 from public.incidents i where i.id = incident_id and i.reporter_id = auth.uid()));
drop policy if exists updates_staff on public.ticket_updates; create policy updates_staff on public.ticket_updates for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin() and author_id = auth.uid());
drop policy if exists updates_resident_read on public.ticket_updates; create policy updates_resident_read on public.ticket_updates for select using (exists (select 1 from public.tickets t join public.incidents i on i.id = t.incident_id where t.id = ticket_id and i.reporter_id = auth.uid()));
drop policy if exists announcements_read on public.announcements; create policy announcements_read on public.announcements for select using (is_published = true or public.current_user_role() in ('admin', 'department_head'));
drop policy if exists announcements_manage on public.announcements; create policy announcements_manage on public.announcements for all using (public.current_user_role() in ('admin', 'department_head')) with check (public.current_user_role() in ('admin', 'department_head'));
drop policy if exists notifications_own on public.notifications; create policy notifications_own on public.notifications for select using (user_id = auth.uid() or (user_id is null and auth.uid() is not null));
drop policy if exists notifications_read on public.notifications; create policy notifications_read on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_staff_insert on public.notifications; create policy notifications_staff_insert on public.notifications for insert with check (public.is_staff_or_admin());
drop policy if exists devices_own on public.user_devices; create policy devices_own on public.user_devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists feedback_own on public.feedback; create policy feedback_own on public.feedback for insert with check (user_id = auth.uid()); create policy feedback_staff_read on public.feedback for select using (public.is_staff_or_admin() or user_id = auth.uid());
drop policy if exists logs_admin_read on public.system_logs; create policy logs_admin_read on public.system_logs for select using (public.current_user_role() = 'admin');
drop policy if exists settings_read on public.system_settings; create policy settings_read on public.system_settings for select using (auth.uid() is not null); create policy settings_admin_write on public.system_settings for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public) values ('incident-photos', 'incident-photos', false) on conflict (id) do nothing;
drop policy if exists incident_photo_read on storage.objects; create policy incident_photo_read on storage.objects for select using (bucket_id = 'incident-photos' and auth.uid() is not null);
drop policy if exists incident_photo_upload on storage.objects; create policy incident_photo_upload on storage.objects for insert with check (bucket_id = 'incident-photos' and auth.uid() is not null and (public.current_user_role() in ('resident', 'staff', 'admin')));

alter publication supabase_realtime add table public.incidents; alter publication supabase_realtime add table public.tickets; alter publication supabase_realtime add table public.notifications; alter publication supabase_realtime add table public.announcements;

create or replace function public.analytics_summary() returns jsonb language sql stable security definer set search_path = public as $$ select jsonb_build_object('total_incidents', count(*), 'pending_verification', count(*) filter (where status = 'pending'), 'active_responses', count(*) filter (where status = 'responding'), 'resolved_today', count(*) filter (where status = 'resolved' and resolved_at::date = current_date), 'critical_incidents', count(*) filter (where priority = 'critical' and status not in ('closed','rejected'))) from public.incidents $$;
create or replace function public.analytics_incidents_by_type() returns table(incident_type text, total bigint) language sql stable security definer set search_path = public as $$ select i.incident_type, count(*) from public.incidents i group by i.incident_type order by count(*) desc $$;
create or replace function public.analytics_incidents_by_barangay() returns table(barangay text, total bigint) language sql stable security definer set search_path = public as $$ select i.barangay, count(*) from public.incidents i group by i.barangay order by count(*) desc $$;
create or replace function public.analytics_response_times() returns table(day date, median_minutes numeric) language sql stable security definer set search_path = public as $$ select date_trunc('day', reported_at)::date, percentile_cont(.5) within group (order by extract(epoch from (coalesce(resolved_at, now()) - reported_at))/60) from public.incidents group by 1 order by 1 desc limit 30 $$;
