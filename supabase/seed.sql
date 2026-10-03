-- Non-sensitive defaults only. User records are created by Supabase Auth and the
-- handle_new_auth_user trigger; never seed passwords or service credentials.
insert into public.system_settings(key, value, description) values
  ('ticket_prefix', '"TGN"', 'Server-generated ticket prefix'),
  ('max_incident_photos', '5', 'Maximum photos accepted per incident'),
  ('default_timezone', '"Asia/Manila"', 'Municipal operations timezone'),
  ('offline_sync_enabled', 'true', 'Allow clients to queue reports while offline')
on conflict (key) do update set value = excluded.value, description = excluded.description;
