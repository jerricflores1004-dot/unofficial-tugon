import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';
export async function PATCH(_: Request, { params }: { params: { id: string } }) { const auth = await requireRole(); if ('error' in auth) return auth.error; const { error } = await auth.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', params.id).eq('user_id', auth.user.id); if (error) return badRequest('Unable to update notification.', 500); return NextResponse.json({ ok: true }); }
