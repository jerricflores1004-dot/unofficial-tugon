# TUGON architecture

## System boundaries

- **Flutter mobile** is the resident-facing client. It uses `supabase_flutter` for authenticated queries, an explicit offline report queue, `image_picker` for evidence, `go_router` for guarded navigation, and FCM device registration through the web API. Announcements, notifications, and the incident-type vocabulary are all read from the database.
- **Next.js web** is the MDRRMO operations workspace. App Router pages share a tokenized component system. API route handlers validate request bodies with Zod, read the authenticated Supabase session from HTTP-only cookies, and rely on database RLS for the final authorization decision.
- **Supabase** supplies Auth, PostgreSQL, Realtime, Storage, and the database security boundary. No service-role credential is sent to browsers or mobile clients.

## Request flow

1. Supabase Auth establishes the session.
2. `public.users` is provisioned by the `on_auth_user_created` trigger.
3. Web handlers call `requireRole`, then query through the user session so RLS is always applied. Resident incident creation is restricted to `reporter_id = auth.uid()`.
4. An incident insert runs the deterministic priority trigger and creates its server-side ticket number in the same database transaction.
5. Realtime broadcasts incident, ticket, notification, and announcement changes to authorized subscriptions.
6. Photo uploads are streamed to the private Storage bucket and only metadata is stored in PostgreSQL.
7. Mutations create an immutable `system_logs` trail or ticket update record.

## Operational safety

- Critical severity maps to critical priority. High severity with at least one vulnerable group also maps to critical. Other levels map directly. The priority is computed in PostgreSQL and never trusted from a client.
- API errors are sanitized. Database details are logged server-side, not returned to residents.
- RLS is enabled on every application table. Frontend role gating is usability, not the security boundary.
- Realtime is a convenience layer; views always have a server query path and pagination.

## Data provenance

There is **no demo mode and no sample dataset anywhere in this repository**. The
former `web/lib/demo-data.ts` module and the `NEXT_PUBLIC_DEMO_MODE` switch have
been removed, along with the placeholder sign-in credential that accompanied
them. The rules the code follows:

- **One source of truth.** Every screen reads PostgreSQL through the `/api/*`
  handlers, under the caller's own session so RLS applies. No component carries
  a fallback array, and `web/lib/api-client.ts` has no sample-data branch.
- **Derived values stay in SQL.** Aggregations, KPI deltas, medians, trends, and
  workspace counters are `security definer` read models in migration `002`, not
  client-side arithmetic over a hardcoded fixture.
- **Configuration, not constants.** Timezone, day boundaries, ticket prefix,
  photo ceiling, map centre and zoom, and the offline-sync policy are read from
  `system_settings`. The incident-type vocabulary lives in `incident_types`.
- **Nothing is invented on failure.** An unreachable database yields an explicit
  error state; an empty database yields genuine zeros and empty states. The
  login page refuses to sign in when Supabase is not configured, and the map
  panel reports that no provider is configured rather than drawing fake markers.
- **The seed is configuration only.** `supabase/seed.sql` writes ten settings and
  ten incident types, and inserts zero operational rows. `supabase db reset`
  therefore produces a clean, empty, fully functional system.
