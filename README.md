# TUGON
## Disaster Incident Reporting and Response Management System

TUGON is a production-oriented monorepo for the Municipal Disaster Risk Reduction and Management Office (MDRRMO) of Mabini, Batangas. It contains a Next.js operations workspace for authorized MDRRMO personnel, a Flutter resident application, and a Supabase/PostgreSQL backend with RLS, Realtime, Storage, and auditable workflows.

> **No AI and no SMS.** Priority calculation, authorization, and notification behavior are deterministic and explainable.

## Repository layout

```text
mobile/                 Flutter resident application
web/                    Next.js 14 App Router operations workspace
supabase/migrations/    PostgreSQL schema, triggers, RLS, RPC read models
supabase/seed.sql       Configuration and vocabulary only — zero sample records
shared/                 Shared domain types
docs/                   Architecture, API, schema, manual, deployment
```

## Quick start: operations workspace

```bash
cp .env.example web/.env.local   # then fill in your Supabase URL and anon key
npm install
supabase db reset                # applies both migrations, then the clean seed
npm run dev
```

Open `http://localhost:3000` and sign in with a real Supabase Auth account. The
workspace has **no demo mode, no seeded credentials, and no fallback dataset**:
if Supabase is not configured the sign-in page says so and refuses to continue,
and if a query fails each panel shows an error or an empty state rather than
invented rows.

## Data provenance

Every value on screen is read from PostgreSQL through the Next.js `/api/*`
routes, which query under the caller's own Supabase session so RLS always
applies. Specifically:

- **KPIs, charts, and counters** come from the RPC read models in
  `supabase/migrations/002_database_backed_read_models.sql`
  (`analytics_summary`, `analytics_incident_trend`, `analytics_priority_mix`,
  `analytics_incidents_by_type`, `analytics_incidents_by_barangay`,
  `analytics_response_times`, `analytics_operations_pulse`,
  `workspace_summary`). Period-over-period deltas are computed from real date
  ranges, not fabricated.
- **Incident-type dropdowns** come from `public.incident_types`. If that table is
  empty the form falls back to free-text entry instead of a hardcoded list.
- **Map centre, zoom, ticket prefix, photo limit, timezone, and offline sync**
  come from `public.system_settings`.
- **Priority** is never sent by a client. It is derived by a PostgreSQL trigger
  from severity and vulnerable groups.
- **Ticket numbers** are generated server-side by `create_incident_ticket()` in
  the same transaction as the insert.
- **CSV exports** are generated on demand from the rows currently in the
  database. No export history is pre-populated.

`supabase/seed.sql` writes **only** configuration and controlled vocabulary
(ten `system_settings` rows and ten `incident_types` rows). It inserts no
incidents, tickets, responders, users, notifications, announcements, feedback,
photos, or log entries. It uses `on conflict do nothing`, so re-running it never
overwrites an operator's edits. A fresh `supabase db reset` therefore yields an
empty, working system whose dashboards read all zeros until real reports arrive.

## Connect Supabase

1. Install the Supabase CLI and run `supabase login`.
2. Link this checkout to the project and apply migrations:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push          # 001_initial_schema.sql then 002_database_backed_read_models.sql
   supabase db seed          # configuration and vocabulary only
   ```

3. Copy the values in `.env.example` into `web/.env.local` or the Vercel project settings. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is not used by browser code.
4. Confirm the private `incident-photos` Storage bucket exists (the migration creates it) and verify its policies.
5. Configure Auth email templates and the allowed redirect URL.
6. Create the first accounts in Supabase Auth. The `handle_new_auth_user`
   trigger provisions the matching `public.users` row; promote it to `admin`
   with `update public.users set role = 'admin' where email = 'you@example.com';`

Migration `001` creates the enums, thirteen tables, foreign key and search
indexes, the `TGN-YYYYMMDD-XXXX` server-side ticket generator, priority
trigger, audit log trigger, RLS policies, the Storage bucket, and the Realtime
publication. Migration `002` adds the `incident_types` vocabulary table and the
settings-aware read models the workspace queries. Both are idempotent.

## Verification

```bash
npm run build
npm run lint
npm run test
```

For the Android-only Flutter resident app, Android Studio on Windows is supported. Follow the mobile setup in `docs/deployment-guide.md` first, then run these checks from PowerShell:

```powershell
cd mobile
flutter analyze
flutter test
# Start an Android emulator or connect an Android device, then find its ID.
flutter devices
flutter run -d YOUR_ANDROID_DEVICE_ID
```

See `docs/deployment-guide.md` for Vercel, Firebase Cloud Messaging, Google Maps, and Android setup and release builds.
