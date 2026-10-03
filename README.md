# TUGON
## Disaster Incident Reporting and Response Management System

TUGON is a production-oriented monorepo for the Municipal Disaster Risk Reduction and Management Office (MDRRMO) of Mabini, Batangas. It contains a Next.js operations workspace for authorized MDRRMO personnel, a Flutter resident application, and a Supabase/PostgreSQL backend with RLS, Realtime, Storage, and auditable workflows.

> **No AI and no SMS.** Priority calculation, authorization, and notification behavior are deterministic and explainable.

## Repository layout

```text
mobile/                 Flutter resident application
web/                    Next.js 14 App Router operations workspace
supabase/migrations/    PostgreSQL schema, triggers, RLS, RPC analytics
supabase/seed.sql       Non-sensitive operational defaults
shared/                 Shared domain types
docs/                   Architecture, API, schema, manual, deployment
```

## Quick start: operations workspace

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_DEMO_MODE=true for a local visual review only.
npm install
npm run dev
```

Open `http://localhost:3000`. The review workspace intentionally uses clearly marked, non-production sample records only when `NEXT_PUBLIC_DEMO_MODE=true` or when no Supabase URL is present. Production paths do not fall back to sample data: they require Supabase Auth and RLS-backed queries.

The visual review sign-in is `staff@tugon.local` / `Mabini2026!`. This credential is a local-only shortcut in the UI and is not enabled when Supabase is configured. Production sign-in uses Supabase Auth.

## Connect Supabase

1. Install the Supabase CLI and run `supabase login`.
2. Link this checkout to the project and apply migrations:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase db seed
   ```

3. Copy the values in `.env.example` into `web/.env.local` or the Vercel project settings. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is not used by browser code.
4. Create an `incident-photos` Storage bucket if it was not created by the migration and verify its policies.
5. Configure Auth email templates and the allowed redirect URL.

The migration creates the required tables, foreign key and search indexes, the `TGN-YYYYMMDD-XXXX` server-side ticket generator, priority trigger, audit log trigger, analytics functions, Realtime publication, Storage policies, and role-aware RLS policies.

## Verification

```bash
npm run build
npm run lint
```

For Flutter:

```bash
cd mobile
cp .env.example .env
flutter pub get
flutter analyze
flutter test
flutter run
```

See `docs/deployment-guide.md` for Vercel, Firebase Cloud Messaging, Google Maps, Android, and iOS setup.
