import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';

/** Marks every notification addressed to the signed-in profile as read. */
export async function PATCH() {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .is('read_at', null)
    .select('id');
  if (error) return badRequest('Unable to update notifications.', 500);
  return NextResponse.json({ data: { updated: data?.length ?? 0 } });
}
