# Database schema

The canonical schema is `supabase/migrations/001_initial_schema.sql`.
`supabase/migrations/002_database_backed_read_models.sql` adds the
`incident_types` vocabulary table and the settings-aware read models the
workspace queries. Neither migration contains sample rows, and
`supabase/seed.sql` writes configuration and vocabulary only.

| Table | Purpose |
| --- | --- |
| `users` | Auth-linked profile, role, barangay, active state |
| `incidents` | Resident report, location, severity, priority, lifecycle |
| `incident_photos` | Private Storage object metadata; the ceiling comes from `system_settings.max_incident_photos` |
| `tickets` | One response ticket per incident, server ticket number |
| `ticket_updates` | Internal notes, status and field updates |
| `responders` | Units, availability, location, check-in |
| `announcements` | Normal, important, or urgent published information |
| `notifications` | In-app history, read state, notification type |
| `user_devices` | FCM device tokens, never shown publicly |
| `feedback` | Resident rating and optional feedback |
| `system_logs` | Actor, action, entity, metadata, timestamp |
| `system_settings` | JSON configuration values with admin-only writes |
| `incident_types` | Controlled incident vocabulary backing every type dropdown |

Important relationships:

- `auth.users 1—1 public.users`
- `users 1—many incidents`, `notifications`, `feedback`
- `incidents 1—1 tickets`, `incidents 1—many incident_photos`
- `tickets 1—many ticket_updates`
- `responders 1—many incidents/tickets`

Indexes cover status, priority, reported time, barangay, reporter, coordinates,
ticket status, notification unread state, ticket update chronology, audit
chronology, and trigram search on type/location. See the migration for the full
RLS matrix.

## Read models

These functions are `security definer` with `search_path = public` so they can
aggregate across rows the caller's RLS would otherwise hide; access is gated by
`requireRole()` in the API layer. All of them read their parameters from
`system_settings`, so changing a setting changes behaviour without a redeploy.

| Function | Returns |
| --- | --- |
| `analytics_summary(p_days)` | Totals for the window plus the previous window, for real KPI deltas |
| `analytics_incident_trend(p_days)` | One zero-filled row per day: reports and resolutions |
| `analytics_priority_mix()` | Exactly four rows; counts active incidents (not `resolved`/`closed`/`rejected`) |
| `analytics_incidents_by_type(p_limit)` | Grouped incident counts |
| `analytics_incidents_by_barangay(p_limit)` | Grouped incident counts |
| `analytics_response_times(p_days)` | Per-day median minutes from report to resolution |
| `analytics_operations_pulse()` | Table-level operational counters and data-quality gaps |
| `workspace_summary()` | Viewer role, staff flag, attention count, unread count |

Supporting readers: `ops_timezone()`, `ops_day_start(p_offset_days)`,
`setting_number()`, `max_incident_photos()`, `active_incident_types()`, and
`create_incident_ticket()`.
