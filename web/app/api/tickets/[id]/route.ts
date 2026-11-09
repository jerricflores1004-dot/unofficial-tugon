import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

const SELECT = '*, incident:incidents(id, incident_type, barangay, location_text, priority, status, affected_people, reported_at),'
  + ' responder:responders!assigned_responder_id(id, name, unit), updates:ticket_updates(*, author:users!author_id(full_name))';

const schema = z.object({
  status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  assignedResponderId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
}).strict();

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('tickets').select(SELECT).eq('id', params.id).maybeSingle();
  if (error || !data) return badRequest('Ticket not found.', 404);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid ticket update.');
  const values: Record<string, unknown> = {};
  if (parsed.data.status) values.status = parsed.data.status;
  if (parsed.data.assignedResponderId !== undefined) values.assigned_responder_id = parsed.data.assignedResponderId;
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes;
  if (Object.keys(values).length === 0) return badRequest('Nothing to update.');
  const { data, error } = await auth.supabase.from('tickets').update(values).eq('id', params.id).select(SELECT).single();
  if (error) return badRequest('Unable to update ticket.', 500);
  return NextResponse.json({ data });
}
