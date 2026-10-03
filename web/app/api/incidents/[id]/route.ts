import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

const SELECT = '*, photos:incident_photos(id, original_name, content_type, size_bytes, storage_path, created_at),'
  + ' ticket:tickets(*, updates:ticket_updates(*, author:users!author_id(full_name))),'
  + ' reporter:users!reporter_id(id, full_name, phone, barangay),'
  + ' responder:responders!assigned_responder_id(id, name, unit, availability),'
  + ' verifier:users!verified_by(id, full_name)';

const update = z.object({
  status: z.enum(['pending', 'verified', 'responding', 'resolved', 'closed', 'rejected']).optional(),
  assignedResponderId: z.string().uuid().nullable().optional(),
  internalNote: z.string().min(1).max(2000).optional(),
}).strict();

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  if (!z.string().uuid().safeParse(params.id).success) return badRequest('Incident not found.', 404);
  const { data, error } = await auth.supabase.from('incidents').select(SELECT).eq('id', params.id).maybeSingle();
  if (error || !data) return badRequest('Incident not found.', 404);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const parsed = update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid incident update.');

  const values: Record<string, unknown> = {};
  if (parsed.data.status) {
    values.status = parsed.data.status;
    if (parsed.data.status === 'verified') { values.verified_by = auth.user.id; values.verified_at = new Date().toISOString(); }
    if (parsed.data.status === 'resolved') values.resolved_at = new Date().toISOString();
  }
  if (parsed.data.assignedResponderId !== undefined) values.assigned_responder_id = parsed.data.assignedResponderId;

  let data = null;
  if (Object.keys(values).length > 0) {
    const result = await auth.supabase.from('incidents').update(values).eq('id', params.id).select('*, ticket:tickets(ticket_number)').single();
    if (result.error) return badRequest('Unable to update incident.', 500);
    data = result.data;
  }
  if (parsed.data.internalNote) {
    const { error: noteError } = await auth.supabase.from('ticket_updates').insert({
      incident_id: params.id, author_id: auth.user.id, update_type: 'internal_note', message: parsed.data.internalNote,
    });
    if (noteError) return badRequest('Incident updated but the note could not be saved.', 500);
  }
  if (!data) {
    const current = await auth.supabase.from('incidents').select('*, ticket:tickets(ticket_number)').eq('id', params.id).single();
    if (current.error) return badRequest('Unable to load incident.', 500);
    data = current.data;
  }
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const { error } = await auth.supabase.from('incidents').delete().eq('id', params.id);
  if (error) return badRequest('Unable to delete incident.', 500);
  return NextResponse.json({ ok: true });
}
