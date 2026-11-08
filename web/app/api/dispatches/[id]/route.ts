import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const COLUMNS = 'id, ticket_id, agency, status, note, dispatched_at, acknowledged_at, completed_at, completion_note, return_note, verified_at';

const schema = z.object({
  action: z.enum(['verify', 'return']),
  note: z.string().trim().max(1000).optional(),
}).strict().refine(
  (value) => value.action !== 'return' || (value.note?.length ?? 0) >= 3,
  { message: 'Tell the agency what needs to be redone.', path: ['note'] },
);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  if (!z.string().uuid().safeParse(params.id).success) return badRequest('Dispatch not found.', 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((item) => item.path[0] === 'note');
    return badRequest(issue?.message ?? 'Invalid request.');
  }

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data: current } = await admin
    .from('ticket_dispatches')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!current) return badRequest('Dispatch not found.', 404);
  if (current.status !== 'completed') {
    return badRequest('Only a completion report that is awaiting verification can be verified or returned.', 409);
  }

  const values = parsed.data.action === 'verify'
    ? { status: 'verified', verified_by: auth.user.id, verified_at: new Date().toISOString() }
    : { status: 'responding', return_note: parsed.data.note, completed_at: null };

  const { data, error } = await admin
    .from('ticket_dispatches')
    .update(values)
    .eq('id', params.id)
    .eq('status', 'completed')
    .select(COLUMNS)
    .single();

  if (error) return badRequest('Unable to update this dispatch.', 500);
  return NextResponse.json({ data });
}