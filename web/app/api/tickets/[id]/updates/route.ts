import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('ticket_updates').select('*, author:users!author_id(full_name)').eq('ticket_id', params.id).order('created_at', { ascending: true });
  if (error) return badRequest('Unable to load ticket updates.', 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({
    message: z.string().min(1).max(2000),
    updateType: z.enum(['status_change', 'internal_note', 'field_update']).default('internal_note'),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Update message is required.');
  const { data, error } = await auth.supabase.from('ticket_updates').insert({
    ticket_id: params.id, author_id: auth.user.id, update_type: parsed.data.updateType, message: parsed.data.message,
  }).select('*, author:users!author_id(full_name)').single();
  if (error) return badRequest('Unable to save ticket update.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
