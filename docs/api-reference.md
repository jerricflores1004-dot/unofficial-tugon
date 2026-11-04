# API reference

All endpoints use JSON unless noted. Authenticated endpoints use the Supabase
session cookie set by Auth. Every handler calls `requireRole()` and then queries
through **the caller's own session**, so PostgreSQL row level security makes the
final authorization decision. The API returns sanitized errors with an `error`
string; database details are logged server-side only. Request bodies are
validated with Zod.

Roles: `resident`, `staff`, `department_head`, `admin`. "Staff" below means
`staff`, `department_head`, or `admin`.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Resident registration (`email`, `password`, `fullName`, optional `phone`). The `handle_new_auth_user` trigger creates the `public.users` row. |
| `POST` | `/api/auth/login` | Sign in (`email`, `password`). |
| `POST` | `/api/auth/responder-login` | Responder sign in (`email`, `password`, `agency`, `team`). `team` (`alpha`, `bravo`, or `charlie`) is required for `agency: "mdrrmo"` and must be absent for the other agencies. The profile must be active and registered under the same agency; MDRRMO profiles must also match the field team, while other agencies must carry no team. |
| `POST` | `/api/auth/logout` | Clears the session cookie. |
| `POST` | `/api/auth/reset-password` | Sends a Supabase recovery email (`email`). |

There are no built-in or seeded credentials. Accounts are created through
Supabase Auth and promoted by an admin.

## Workspace shell

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/workspace/summary` | Profile, role, `is_staff`, `attention_incidents`, `unread_notifications`, and integration availability. Backed by the `workspace_summary()` RPC. Integration flags report **configured / configuration required** based on server environment and a live Storage probe — never a hardcoded "connected". |

## Incidents

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/incidents` | RLS-scoped paginated list. Filters: `status`, `priority`, `search` (ticket, type, barangay, location, reporter, responder), `since`, `until`, `from`, `limit`, `geolocated`, `unassigned`. |
| `POST` | `/api/incidents` | Resident report. `priority` is **not accepted**; a PostgreSQL trigger derives it. The ticket number is generated in the same transaction. |
| `GET` | `/api/incidents/:id` | Detail with embedded reporter, responder, ticket, updates, and photos. |
| `PATCH` | `/api/incidents/:id` | Staff lifecycle update. Accepts only `status`, `assignedResponderId`, `internalNote` (`.strict()`). |
| `DELETE` | `/api/incidents/:id` | Admin, per the RLS delete policy. |
| `GET` | `/api/incidents/:id/photos` | Signed URLs for the private `incident-photos` bucket. |
| `POST` | `/api/incidents/:id/photos` | Multipart image upload. Max 8 MB each; the per-incident ceiling is read from `system_settings.max_incident_photos`. |

## Tickets

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/api/tickets` | List (filters mirror incidents) and create. |
| `GET`, `PATCH` | `/api/tickets/:id` | Detail and assignment/status update. |
| `GET`, `POST` | `/api/tickets/:id/updates` | Immutable internal timeline. |

## Incident types

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/incident-types` | Any authenticated user. Returns active rows from `public.incident_types` via `active_incident_types()`. This is the source for every incident-type dropdown. |
| `POST` | `/api/incident-types` | Staff. Add a vocabulary entry (`label`, optional `description`, `sortOrder`). |
| `DELETE` | `/api/incident-types` | Staff. JSON body `{ "id": "<uuid>" }`. **Retires** the entry (`is_active = false`) rather than deleting it, so historical incidents keep a meaningful label. |

If the table is empty the clients fall back to free-text entry rather than a
hardcoded list.

## Analytics

All analytics endpoints proxy the SQL read models in
`supabase/migrations/002_database_backed_read_models.sql`. They contain no
in-memory calculations and no fallback constants; on an empty database they
return genuine zeros.

| Method | Path | Query | RPC |
| --- | --- | --- | --- |
| `GET` | `/api/analytics/summary` | `days` | `analytics_summary(p_days)` — totals plus the previous-period comparison used for KPI deltas |
| `GET` | `/api/analytics/incident-trend` | `days` | `analytics_incident_trend(p_days)` — one row per day, zero-filled |
| `GET` | `/api/analytics/priority-mix` | — | `analytics_priority_mix()` — always four rows; active incidents only |
| `GET` | `/api/analytics/incidents-by-type` | `limit` | `analytics_incidents_by_type(p_limit)` |
| `GET` | `/api/analytics/incidents-by-barangay` | `limit` | `analytics_incidents_by_barangay(p_limit)` |
| `GET` | `/api/analytics/response-times` | `days` | `analytics_response_times(p_days)` — median minutes to resolution per day |
| `GET` | `/api/analytics/operations-pulse` | — | `analytics_operations_pulse()` — table-level operational counts |

## Operations

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/api/responders` | Units and availability. |
| `PATCH`, `DELETE` | `/api/responders/:id` | Staff/admin. |
| `GET`, `POST` | `/api/announcements` | Published information; `POST` is staff. |
| `PATCH`, `DELETE` | `/api/announcements/:id` | Staff/admin. |
| `GET` | `/api/notifications` | Viewer's own rows plus broadcasts (`user_id is null`). |
| `POST` | `/api/notifications/send` | Staff. Writes the row first, then attempts FCM; delivery status is returned separately so history survives a provider outage. |
| `PATCH` | `/api/notifications/:id/read` | Marks one notification read. |
| `PATCH` | `/api/notifications/read-all` | Marks the viewer's own unread notifications read. Broadcasts carry no per-user read state. |
| `POST` | `/api/notifications/register-device` | Upserts an FCM token into `user_devices`. |

## Administration

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `PATCH` | `/api/settings` | `system_settings`. Reads for authenticated users; writes are admin-only. |
| `GET`, `POST` | `/api/users` | Admin. Create accepts optional `agency` and `team` (`team` only with `agency: "mdrrmo"`). |
| `PATCH`, `DELETE` | `/api/users/:id` | Admin role/access changes, including `agency` and `team` (a field team is only valid on MDRRMO profiles; changing agency resets the team). |
| `GET` | `/api/logs` | Admin. `system_logs` audit trail written by triggers. |
| `GET`, `POST` | `/api/feedback` | Resident rating of a resolved incident. |
