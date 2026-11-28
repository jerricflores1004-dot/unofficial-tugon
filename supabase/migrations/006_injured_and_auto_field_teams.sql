-- TUGON migration 006 — injured count and automatic field-team assignment
-- Apply with: supabase db push  (apply BEFORE installing the new app or deploying the web)
--
-- 1. Residents now report two numbers: people affected (stranded, displaced)
--    and people injured or in danger. Any injured person raises the AI's
--    life-threat score to at least 2 (High).
-- 2. When the AI dispatches an agency, the first free MDRRMO field team
--    (Alpha, Bravo, Charlie) is attached automatically, so the observer row
--    has no human assigner.

alter table public.incidents
  add column if not exists injured_people integer not null default 0 check (injured_people >= 0);

comment on column public.incidents.injured_people is
  'People injured or in danger, as reported by the resident. Separate from affected_people.';

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dispatch_observers' and column_name = 'assigned_by'
  ) then
    alter table public.dispatch_observers alter column assigned_by drop not null;
  end if;
end $$;
