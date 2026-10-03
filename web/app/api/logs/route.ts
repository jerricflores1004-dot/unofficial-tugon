import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 100) || 100, 1), 500);
  const { data, error } = await auth.supabase
    .from('system_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at, actor:users!actor_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return badRequest('Unable to load audit logs.', 500);
  return NextResponse.json({ data: data ?? [] });
}
