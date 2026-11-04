-- TUGON migration 003 — responder agencies and teams
-- Apply with: supabase db push
--
-- Purpose: authorise responder organisations (Bureau of Fire Protection,
-- Philippine National Police, Philippine Coast Guard) and the MDRRMO's field
-- teams (Alpha, Bravo, Charlie) as sign-in identities for the operations
-- workspace. Each staff profile can carry one agency plus, for MDRRMO
-- accounts, one field team. The columns are nullable: resident accounts and
-- accounts created before this migration keep working unchanged.
--
-- This migration inserts NO operational rows. Every agency/team value is
-- assigned by a system administrator through the users workspace.

-- 1. Responder agency vocabulary ---------------------------------------------
do $$ begin create type public.responder_agency as enum ('bfp', 'pnp', 'coast_guard', 'mdrrmo'); exception when duplicate_object then null; end $$;

-- 2. MDRRMO field teams -------------------------------------------------------
do $$ begin create type public.responder_team as enum ('alpha', 'bravo', 'charlie'); exception when duplicate_object then null; end $$;

-- 3. Attach agency and team to user profiles --------------------------------
alter table public.users
  add column if not exists agency public.responder_agency,
  add column if not exists team public.responder_team;

create index if not exists users_agency_idx on public.users(agency);
create index if not exists users_team_idx on public.users(team);

-- 4. Keep updated_at maintained ----------------------------------------------
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- 5. Row level security ------------------------------------------------------
-- No new policies are required: the existing users_select policy already lets
-- any signed-in user read their own profile (including agency and team), and
-- lets staff, admins, and department heads read every profile. Only admins
-- may insert or mass-update profiles through the users API, so agency and
-- team stay administrator-controlled.

-- 6. Comments for operators --------------------------------------------------
comment on column public.users.agency is
  'Responder agency the profile signs in as: bfp, pnp, coast_guard, mdrrmo. Null for residents.';
comment on column public.users.team is
  'MDRRMO field team: alpha, bravo, charlie. Only meaningful for mdrrmo profiles.';
