import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

const SELECT = '*, incident:incidents(id, incident_type, barangay, location_text, priority, status, affected_people, reported_at),'
  + ' responder:responders!assigned_responder_id(id, name, unit), updates:ticket_updates(id)';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 25) || 25, 1), 100);
  const from = Math.max(Number(url.searchParams.get('from') ?? 0) || 0, 0);
  const status = url.searchParams.get('status');
  const allowed = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
  if (status && !allowed.includes(status)) return badRequest('Unknown ticket status filter.');

  let query = auth.supabase.from('tickets').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (status) query = query.eq('status', status);
  if (url.searchParams.get('unassigned') === 'true') query = query.is('assigned_responder_id', null);

  const { data, error, count } = await query;
  if (error) return badRequest('Unable to load response tickets.', 500);
  return NextResponse.json({ data: data ?? [], count: count ?? 0, from, limit });
}

const schema = z.object({
  incidentId: z.string().uuid(),
  assignedResponderId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('A valid incident is required.');
  const { data: ticket, error } = await auth.supabase.from('tickets').insert({
    incident_id: parsed.data.incidentId,
    assigned_responder_id: parsed.data.assignedResponderId ?? null,
    created_by: auth.user.id,
    notes: parsed.data.notes || null,
    status: parsed.data.assignedResponderId ? 'assigned' : 'open',
  }).select(SELECT).single();
  if (error) return badRequest('Unable to create response ticket.', 500);
  return NextResponse.json({ data: ticket }, { status: 201 });
}
