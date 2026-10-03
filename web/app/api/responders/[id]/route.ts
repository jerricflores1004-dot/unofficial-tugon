import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';

const SELECT = '*';

const patch = z.object({
  availability: z.enum(['available', 'deployed', 'standby', 'offline']).optional(),
  currentLocation: z.string().max(240).nullable().optional(),
  checkIn: z.boolean().optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['staff', 'admin']);
  if ('error' in auth) return auth.error;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid responder update.');
  const values: Record<string, unknown> = {};
  if (parsed.data.availability) values.availability = parsed.data.availability;
  if (parsed.data.currentLocation !== undefined) values.current_location = parsed.data.currentLocation;
  if (parsed.data.checkIn) values.last_check_in = new Date().toISOString();
  if (Object.keys(values).length === 0) return badRequest('Nothing to update.');
  const { data, error } = await auth.supabase.from('responders').update(values).eq('id', params.id).select(SELECT).single();
  if (error) return badRequest('Unable to update responder.', 500);
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const { error } = await auth.supabase.from('responders').delete().eq('id', params.id);
  if (error) return badRequest('Unable to remove responder.', 500);
  return NextResponse.json({ ok: true });
}
