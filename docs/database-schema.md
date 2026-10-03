# Database schema

The canonical schema is `supabase/migrations/001_initial_schema.sql`.

| Table | Purpose |
| --- | --- |
| `users` | Auth-linked profile, role, barangay, active state |
| `incidents` | Resident report, location, severity, priority, lifecycle |
| `incident_photos` | Private Storage object metadata, max five through API |
| `tickets` | One response ticket per incident, server ticket number |
| `ticket_updates` | Internal notes, status and field updates |
| `responders` | Units, availability, location, check-in |
| `announcements` | Normal, important, or urgent published information |
| `notifications` | In-app history, read state, notification type |
| `user_devices` | FCM device tokens, never shown publicly |
| `feedback` | Resident rating and optional feedback |
| `system_logs` | Actor, action, entity, metadata, timestamp |
| `system_settings` | JSON configuration values with admin-only writes |

Important relationships:

- `auth.users 1—1 public.users`
- `users 1—many incidents`, `notifications`, `feedback`
- `incidents 1—1 tickets`, `incidents 1—many incident_photos`
- `tickets 1—many ticket_updates`
- `responders 1—many incidents/tickets`

Indexes cover status, priority, reported time, barangay, reporter, coordinates, ticket status, notification unread state, ticket update chronology, audit chronology, and trigram search on type/location. See the migration for the full RLS matrix.
