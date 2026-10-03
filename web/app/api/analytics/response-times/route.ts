import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const value = Number(new URL(request.url).searchParams.get('days') ?? 30);
  const days = Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 365) : 30;
  const { data, error } = await auth.supabase.rpc('analytics_response_times', { p_days: days });
  if (error) return badRequest('Unable to load analytics.', 500);
  return NextResponse.json({ data: data ?? [] });
}
