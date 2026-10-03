import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';

export async function GET() {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${auth.user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return badRequest('Unable to load notifications.', 500);
  // Broadcast rows (user_id is null) have no per-user read state, so only rows
  // addressed to the signed-in profile can be unread.
  const rows = (data ?? []).map((row) => ({ ...row, unread: row.read_at === null && row.user_id === auth.user.id }));
  return NextResponse.json({ data: rows });
}
