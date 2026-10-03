import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';
export async function GET() { const auth = await requireRole(['staff', 'admin', 'department_head']); if ('error' in auth) return auth.error; const { data, error } = await auth.supabase.rpc('analytics_summary'); if (error) return badRequest('Unable to load analytics.', 500); return NextResponse.json({ data }); }
