# API reference

All endpoints use JSON unless noted. Authenticated endpoints use the Supabase session cookie set by Auth. The API returns sanitized errors with an `error` string. Request bodies are validated with Zod.

## Auth

- `POST /api/auth/register` — resident registration (`email`, `password`, `fullName`, optional `phone`)
- `POST /api/auth/login` — sign in (`email`, `password`)
- `POST /api/auth/logout`
- `POST /api/auth/reset-password` — (`email`)

## Incidents and tickets

- `GET /api/incidents?status=&priority=&search=&from=&limit=` — RLS-scoped paginated list
- `POST /api/incidents` — resident report; server computes priority and ticket
- `GET /api/incidents/:id`
- `PATCH /api/incidents/:id` — staff/admin/department head lifecycle update
- `DELETE /api/incidents/:id` — admin soft boundary / delete policy
- `POST /api/incidents/:id/photos` — multipart image upload, max 8 MB each, max five
- `GET|POST /api/tickets`
- `GET|PATCH /api/tickets/:id`
- `GET|POST /api/tickets/:id/updates`

## Operations

- `GET|PATCH /api/responders/:id`
- `GET|POST /api/announcements`
- `PATCH|DELETE /api/announcements/:id`
- `GET /api/notifications`
- `POST /api/notifications/send`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/register-device`

## Analytics and administration

- `GET /api/analytics/summary`
- `GET /api/analytics/incidents-by-type`
- `GET /api/analytics/incidents-by-barangay`
- `GET /api/analytics/response-times`
- `GET|POST /api/feedback`
- `GET|POST /api/users`, `PATCH|DELETE /api/users/:id` (admin)
- `GET|PATCH /api/settings` (admin writes)
- `GET /api/logs` (admin only)
