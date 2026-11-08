import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  status: z.enum(['acknowledged', 'responding', 'completed']),
  completionNote: z.string().trim().max(2000).optional(),
}).strict().refine(
  (value) => value.status !== 'completed' || (value.completionNote?.length ?? 0) >= 5,
  { message: 'Write a short completion report before submitting.', path: ['completionNote'] },
);

const ORDER = ['dispatched', 'acknowledged', 'responding', 'completed', 'verified'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['department_head']);
  if ('error' in auth) return auth.error;

  const agency = auth.profile.agency;
  if (!agency) return badRequest('Your account is not linked to an agency.', 403);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((item) => item.path[0] === 'completionNote');
    return badRequest(issue?.message ?? 'Invalid status.');
  }

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  // Only a dispatch that belongs to this agency can be found here.
  const { data: current } = await admin
    .from('ticket_dispatches')
    .select('id, ticket_id, status, acknowledged_at')
    .eq('id', params.id)
    .eq('agency', agency)
    .maybeSingle();
  if (!current) return badRequest('Dispatch not found.', 404);

  // Status only moves forward. A completed report is locked until the admin acts.
  if (ORDER.indexOf(parsed.data.status) <= ORDER.indexOf(current.status)) {
    return badRequest('That status is already set or has passed.', 409);
  }

  const now = new Date().toISOString();
  const values: Record<string, unknown> = { status: parsed.data.status };
  if (!current.acknowledged_at) values.acknowledged_at = now;
  if (parsed.data.status === 'completed') {
    values.completed_at = now;
    values.completion_note = parsed.data.completionNote;
    values.return_note = null;
  }

  const { data, error } = await admin
    .from('ticket_dispatches')
    .update(values)
    .eq('id', params.id)
    .eq('agency', agency)
    .select('id, status, acknowledged_at, completed_at, completion_note')
    .single();

  if (error) return badRequest('Unable to update this dispatch.', 500);

  // Keep the ticket in step once an agency is on the way (best effort).
  if (parsed.data.status === 'responding') {
    const { error: ticketError } = await admin
      .from('tickets')
      .update({ status: 'in_progress' })
      .eq('id', current.ticket_id)
      .in('status', ['open', 'assigned']);
    if (ticketError) console.error('DISPATCH: ticket status not updated', ticketError.message);
  }

  return NextResponse.json({ data });
}