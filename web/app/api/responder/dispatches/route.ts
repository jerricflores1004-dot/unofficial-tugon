import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const SELECT = `id, status, note, dispatched_at, acknowledged_at, completed_at, completion_note, return_note, verified_at,
  ticket:tickets(id, ticket_number, notes,
    incident:incidents(id, incident_type, description, barangay, location_text,
      latitude, longitude, priority, affected_people, reported_at))`;

export async function GET() {
  const auth = await requireRole(['department_head']);
  if ('error' in auth) return auth.error;

  const agency = auth.profile.agency;
  if (!agency) return badRequest('Your account is not linked to an agency.', 403);

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data, error } = await admin
    .from('ticket_dispatches')
    .select(SELECT)
    .eq('agency', agency)
    .order('dispatched_at', { ascending: false })
    .limit(100);

  if (error) return badRequest('Unable to load dispatches.', 500);
  return NextResponse.json({ data: data ?? [] });
}