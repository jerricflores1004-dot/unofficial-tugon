-- TUGON migration 004 — AI severity triage and automatic agency dispatch
-- Apply with: supabase db push
--
-- Residents no longer pick a severity. After a report is stored, the web API
-- asks Gemini to classify it (low / medium / high / critical) and to choose
-- the responding agencies (BFP, PNP, Philippine Coast Guard). The result is
-- written back to the incident, and one ticket_dispatches row is created per
-- agency. Admins keep seeing every report and its dispatch status.

-- 1. Triage result on each incident ------------------------------------------
alter table public.incidents
  add column if not exists ai_severity public.severity_level,
  add column if not exists ai_agencies text[] not null default '{}',
  add column if not exists ai_reason text,
  add column if not exists ai_source text check (ai_source in ('ai', 'rules')),
  add column if not exists ai_triaged_at timestamptz;

create index if not exists incidents_ai_triaged_idx on public.incidents(ai_triaged_at);

comment on column public.incidents.ai_severity is 'Severity chosen by AI triage. Copied into severity, so the priority trigger runs.';
comment on column public.incidents.ai_agencies is 'Agencies the triage auto-dispatched: bfp, pnp, coast_guard.';
comment on column public.incidents.ai_source is 'ai = Gemini classified it; rules = keyword fallback (AI unavailable).';
comment on column public.incidents.ai_triaged_at is 'Null until triage ran. Admins can see untriaged reports.';

-- 2. Automatic dispatches have no human sender -------------------------------
-- ticket_dispatches was created outside these migrations; relax the sender
-- column only when the table and column exist.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ticket_dispatches' and column_name = 'dispatched_by'
  ) then
    alter table public.ticket_dispatches alter column dispatched_by drop not null;
  end if;
end $$;
