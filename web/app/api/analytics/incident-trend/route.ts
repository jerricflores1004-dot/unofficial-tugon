import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const value = Number(new URL(request.url).searchParams.get('days') ?? 7);
  const range = Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 90) : 7;
  const { data, error } = await auth.supabase.rpc('analytics_incident_trend', { p_days: range });
  if (error) return badRequest('Unable to load the incident trend.', 500);
  return NextResponse.json({ data: data ?? [] });
}
