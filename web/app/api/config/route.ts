import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// Never cached: the answer depends on this deployment's environment.
export const dynamic = 'force-dynamic';

/**
 * Runtime configuration probe.
 *
 * `NEXT_PUBLIC_*` values are inlined when the app is built, so a deployment
 * that only receives its database variables at runtime (for example a Vercel
 * preview environment) would otherwise render "Database not configured" and
 * disable the sign-in form even though the server routes can reach Supabase.
 */
export async function GET() {
  return NextResponse.json(
    {
      supabaseConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
