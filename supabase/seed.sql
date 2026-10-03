-- TUGON seed — configuration only.
--
-- This file deliberately seeds NO operational records. There are no sample
-- incidents, tickets, users, responders, notifications, announcements,
-- feedback rows, or audit log entries anywhere in this repository. Every
-- operational row the web workspace and the resident app display is produced
-- by live database activity.
--
-- What IS seeded:
--   1. public.system_settings — workspace configuration the application reads
--      at runtime (ticket prefix, timezone, photo limit, map defaults).
--   2. public.incident_types — the controlled vocabulary offered by the report
--      form. It is a lookup list, not incident records.
--
-- Both blocks use ON CONFLICT DO NOTHING so re-running `supabase db seed`
-- against a live project never overwrites a value an administrator changed
-- through the workspace. `supabase db reset` still produces a clean database.

-- 1. Workspace configuration -------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('ticket_prefix', to_jsonb('TGN'::text), 'Server-generated ticket prefix'),
  ('max_incident_photos', to_jsonb(5), 'Maximum photos accepted per incident'),
  ('default_timezone', to_jsonb('Asia/Manila'::text), 'Municipal operations timezone'),
  ('offline_sync_enabled', to_jsonb(true), 'Allow clients to queue reports while offline'),
  ('organization_name', to_jsonb('MDRRMO Mabini'::text), 'Organization name shown in workspace settings'),
  ('municipality', to_jsonb('Mabini, Batangas'::text), 'Municipality shown in workspace settings'),
  ('sla_target_minutes', to_jsonb(60), 'Response target used for ticket SLA reporting'),
  ('map_default_latitude', to_jsonb(13.7481), 'Map centre used until geolocated incidents exist'),
  ('map_default_longitude', to_jsonb(120.9416), 'Map centre used until geolocated incidents exist'),
  ('map_default_zoom', to_jsonb(13), 'Map zoom used until geolocated incidents exist')
on conflict (key) do nothing;

-- 2. Incident type vocabulary -------------------------------------------------
-- Residents pick from this list; staff maintain it in the database. If the
-- table is emptied the report form falls back to free-text entry instead of a
-- hardcoded list in the client bundle.
insert into public.incident_types (label, sort_order) values
  ('Flooding', 10),
  ('Flash flood', 20),
  ('Landslide', 30),
  ('Fire', 40),
  ('Medical emergency', 50),
  ('Structural damage', 60),
  ('Missing person', 70),
  ('Power outage', 80),
  ('Road obstruction', 90),
  ('Other', 999)
on conflict (label) do nothing;
