import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

/** Controlled vocabulary for the report form. Stored in the database, never in client source. */
export async function GET() {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.rpc('active_incident_types');
  if (error) return badRequest('Unable to load incident types.', 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({
    label: z.string().min(2).max(80),
    sortOrder: z.number().int().min(0).max(9999).default(100),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('An incident type label is required.');
  const { data, error } = await auth.supabase.from('incident_types')
    .upsert({ label: parsed.data.label, sort_order: parsed.data.sortOrder, is_active: true }, { onConflict: 'label' })
    .select('id, label, sort_order').single();
  if (error) return badRequest('Unable to save the incident type.', 500);
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('A valid incident type id is required.');
  // Retire instead of deleting so historical incidents keep a meaningful label.
  const { error } = await auth.supabase.from('incident_types').update({ is_active: false }).eq('id', parsed.data.id);
  if (error) return badRequest('Unable to retire the incident type.', 500);
  return NextResponse.json({ ok: true });
}
