# TUGON architecture

## System boundaries

- **Flutter mobile** is the resident-facing client. It uses `supabase_flutter` for authenticated queries, an explicit offline report queue, `image_picker` for evidence, `go_router` for guarded navigation, and FCM device registration through the web API.
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
- Demo data is isolated in `web/lib/demo-data.ts` and only available for local visual review. It is not a production data provider.
