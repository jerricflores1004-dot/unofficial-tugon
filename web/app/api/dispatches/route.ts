import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

  const COLUMNS = 'id, ticket_id, agency, status, note, dispatched_at, acknowledged_at, completed_at, completion_note, return_note, verified_at';

export async function GET() {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data, error } = await admin
    .from('ticket_dispatches')
    .select(COLUMNS)
    .order('dispatched_at', { ascending: false })
    .limit(500);

  if (error) return badRequest('Unable to load dispatches.', 500);
  return NextResponse.json({ data: data ?? [] });
}

const schema = z.object({
  ticketId: z.string().uuid(),
  agency: z.enum(['bfp', 'pnp', 'coast_guard']),
  note: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('A valid ticket and agency are required.');

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  // A closed, rejected or resolved report cannot be dispatched.
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, status, incident:incidents(id, status)')
    .eq('id', parsed.data.ticketId)
    .maybeSingle();
  if (!ticket) return badRequest('Ticket not found.', 404);

  const incident = Array.isArray(ticket.incident) ? ticket.incident[0] : ticket.incident;
  if (incident && ['rejected', 'closed', 'resolved'].includes(incident.status)) {
    return badRequest('This incident is already closed and cannot be dispatched.', 409);
  }

  const { data, error } = await admin
    .from('ticket_dispatches')
    .insert({
      ticket_id: parsed.data.ticketId,
      agency: parsed.data.agency,
      note: parsed.data.note || null,
      dispatched_by: auth.user.id,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') return badRequest('That agency is already dispatched to this ticket.', 409);
    return badRequest('Unable to send the dispatch.', 500);
  }

  // Keep the ticket and incident in step with the dispatch (best effort).
  if (ticket.status === 'open') {
    const { error: ticketError } = await admin.from('tickets').update({ status: 'assigned' }).eq('id', ticket.id);
    if (ticketError) console.error('DISPATCH: ticket status not updated', ticketError.message);
  }
  if (incident && ['pending', 'verified'].includes(incident.status)) {
    const { error: incidentError } = await admin.from('incidents').update({ status: 'responding' }).eq('id', incident.id);
    if (incidentError) console.error('DISPATCH: incident status not updated', incidentError.message);
  }

  return NextResponse.json({ data }, { status: 201 });
}