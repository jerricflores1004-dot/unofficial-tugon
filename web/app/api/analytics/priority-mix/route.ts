import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

export async function GET() {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.rpc('analytics_priority_mix');
  if (error) return badRequest('Unable to load the priority distribution.', 500);
  return NextResponse.json({ data: data ?? [] });
}
