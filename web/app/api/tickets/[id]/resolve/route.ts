import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  if (!z.string().uuid().safeParse(params.id).success) return badRequest('Ticket not found.', 404);

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, incident_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!ticket) return badRequest('Ticket not found.', 404);

  const { data: rows, error } = await admin
    .from('ticket_dispatches')
    .select('id, status')
    .eq('ticket_id', ticket.id);
  if (error) return badRequest('Unable to check the dispatches.', 500);

  const allVerified = (rows ?? []).length > 0
    && (rows ?? []).every((row: { status: string }) => row.status === 'verified');
  if (!allVerified) {
    return badRequest('Every dispatched agency must be verified before the incident can be resolved.', 409);
  }

  const now = new Date().toISOString();
  const { error: incidentError } = await admin
    .from('incidents')
    .update({ status: 'resolved', resolved_at: now })
    .eq('id', ticket.incident_id);
  if (incidentError) return badRequest('Unable to resolve the incident.', 500);

  const { error: ticketError } = await admin
    .from('tickets')
    .update({ status: 'resolved' })
    .eq('id', ticket.id);
  if (ticketError) console.error('RESOLVE: ticket status not updated', ticketError.message);

  // Release the field teams that rode along on this incident (best effort).
  const dispatchIds = (rows ?? []).map((row: { id: string }) => row.id);
  if (dispatchIds.length > 0) {
    const { data: attached } = await admin
      .from('dispatch_observers')
      .select('field_team_id')
      .in('dispatch_id', dispatchIds);
    const teamIds = Array.from(new Set((attached ?? []).map((row: { field_team_id: string }) => row.field_team_id)));

    const { error: observerError } = await admin
      .from('dispatch_observers')
      .update({ status: 'done', updated_at: now })
      .in('dispatch_id', dispatchIds);
    if (observerError) console.error('RESOLVE: observers not released', observerError.message);

    if (teamIds.length > 0) {
      const { error: teamError } = await admin
        .from('field_teams')
        .update({ current_incident_id: null, status: 'available' })
        .in('id', teamIds)
        .eq('current_incident_id', ticket.incident_id);
      if (teamError) console.error('RESOLVE: field teams not released', teamError.message);
    }
  }

  return NextResponse.json({ ok: true });
}