import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

/** Readiness, workload, and administrative counters for the workspace views. */
export async function GET() {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.rpc('analytics_operations_pulse');
  if (error) return badRequest('Unable to load the operations pulse.', 500);
  return NextResponse.json({ data });
}
