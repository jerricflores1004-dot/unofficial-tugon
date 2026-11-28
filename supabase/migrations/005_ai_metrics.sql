-- TUGON migration 005 — AI severity metrics
-- Apply with: supabase db push
--
-- The AI now scores five metrics (0–3 each) and describes the reporter's
-- photos; the severity is computed from the scores by a fixed rule
-- (web/lib/severity-matrix.ts, docs/severity-matrix.md). The scores are kept
-- so admins and reviewers can see why a report got its severity.

alter table public.incidents
  add column if not exists ai_metrics jsonb;

comment on column public.incidents.ai_metrics is
  'AI triage scores: life_threat, people_affected, spread_risk, area_scope, resource_need (0-3) and photo_findings. Null for keyword-rule triage.';
