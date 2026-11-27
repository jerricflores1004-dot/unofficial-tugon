import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { triageAndDispatch } from '@/lib/triage';

// Runs AI severity triage and auto-dispatch for one incident.
// Callers: the resident app right after it stores a report (Bearer token of
// the reporter), or an admin from the web workspace (session cookie).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) return badRequest('Invalid incident.');

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (bearer) {
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (!user) return badRequest('Authentication required. Please sign in again.', 401);
    const { data: incident } = await admin.from('incidents').select('reporter_id').eq('id', params.id).maybeSingle();
    if (!incident) return badRequest('Incident not found.', 404);
    if (incident.reporter_id !== user.id) return badRequest('You do not have permission for this operation.', 403);
  } else {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;
  }

  const outcome = await triageAndDispatch(admin, params.id);
  if ('error' in outcome) return badRequest(outcome.error ?? 'Triage failed.', outcome.error === 'Incident not found.' ? 404 : 500);
  return NextResponse.json({ data: outcome });
}
