import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const value = Number(new URL(request.url).searchParams.get('limit') ?? 25);
  const limit = Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 100) : 25;
  const { data, error } = await auth.supabase.rpc('analytics_incidents_by_barangay', { p_limit: limit });
  if (error) return badRequest('Unable to load analytics.', 500);
  return NextResponse.json({ data: data ?? [] });
}
