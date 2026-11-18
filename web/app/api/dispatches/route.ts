import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const COLUMNS = 'id, ticket_id, agency, status, note, dispatched_at, acknowledged_at, completed_at, completion_note, return_note, verified_at';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const ticketId = new URL(request.url).searchParams.get('ticketId');
  if (ticketId && !z.string().uuid().safeParse(ticketId).success) return badRequest('Invalid ticket.');

  let query = admin
    .from('ticket_dispatches')
    .select(COLUMNS)
    .order('dispatched_at', { ascending: false })
    .limit(500);
  if (ticketId) query = query.eq('ticket_id', ticketId);

  const { data, error } = await query;
  if (error) return badRequest('Unable to load dispatches.', 500);

  // Attach the MDRRMO field teams that ride along with each dispatch.
  const rows = (data ?? []) as Record<string, any>[];
  const ids = rows.map((row) => row.id);
  const byDispatch = new Map<string, { id: string; team_name: string; status: string }[]>();
  if (ids.length > 0) {
    const { data: observers } = await admin
      .from('dispatch_observers')
      .select('id, dispatch_id, status, field_team:field_teams(name)')
      .in('dispatch_id', ids);
    for (const item of (observers ?? []) as Record<string, any>[]) {
      const team = Array.isArray(item.field_team) ? item.field_team[0] : item.field_team;
      const list = byDispatch.get(item.dispatch_id) ?? [];
      list.push({ id: item.id, team_name: team?.name ?? 'Field team', status: item.status });
      byDispatch.set(item.dispatch_id, list);
    }
  }

  return NextResponse.json({ data: rows.map((row) => ({ ...row, observers: byDispatch.get(row.id) ?? [] })) });
}

const schema = z.object({
  ticketId: z.string().uuid(),
  agency: z.enum(['bfp', 'pnp', 'coast_guard']),
  note: z.string().max(1000).optional(),
  fieldTeamId: z.string().uuid().optional(),
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

  // Optional MDRRMO field team that rides along with this agency.
  let team: { id: string; user_id: string | null; name: string } | null = null;
  if (parsed.data.fieldTeamId) {
    const { data: found } = await admin
      .from('field_teams')
      .select('id, user_id, name, is_active, current_incident_id')
      .eq('id', parsed.data.fieldTeamId)
      .maybeSingle();
    if (!found || !found.is_active) return badRequest('That field team is not available.', 409);
    if (found.current_incident_id && found.current_incident_id !== incident?.id) {
      return badRequest(`${found.name} is already attached to another incident.`, 409);
    }
    team = found;
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

  // Attach the field team (best effort: the dispatch itself is already sent).
  let observerWarning: string | null = null;
  if (team) {
    const { error: observerError } = await admin
      .from('dispatch_observers')
      .insert({ dispatch_id: data.id, field_team_id: team.id, assigned_by: auth.user.id });
    if (observerError) {
      console.error('DISPATCH: field team not attached', observerError.message);
      observerWarning = `The dispatch was sent, but ${team.name} could not be attached.`;
    } else {
      await admin
        .from('field_teams')
        .update({ current_incident_id: incident?.id ?? null })
        .eq('id', team.id);
      if (team.user_id) {
        const { error: notifyError } = await admin.from('notifications').insert({
          user_id: team.user_id,
          sender_id: auth.user.id,
          title: 'New incident assignment',
          body: `Observe the ${parsed.data.agency.toUpperCase()} response. Check the app for details.`,
          notification_type: 'status_update',
          entity_type: 'incident',
          entity_id: incident?.id ?? null,
        });
        if (notifyError) console.error('DISPATCH: team notification failed', notifyError.message);
      }
    }
  }

  return NextResponse.json({ data, observerWarning }, { status: 201 });
}