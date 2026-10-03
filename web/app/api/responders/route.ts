import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';

const SELECT = '*, assigned_incidents:incidents!assigned_responder_id(id, incident_type, status, reported_at)';

export async function GET() {
  const auth = await requireRole(['staff', 'admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('responders').select(SELECT).order('name');
  if (error) return badRequest('Unable to load responders.', 500);
  return NextResponse.json({ data: data ?? [] });
}

const createResponder = z.object({
  name: z.string().min(2).max(120),
  leadName: z.string().min(2).max(120).optional(),
  unit: z.string().min(2).max(120),
  contactNumber: z.string().min(7).max(40).optional(),
  currentLocation: z.string().max(240).optional(),
  availability: z.enum(['available', 'deployed', 'standby', 'offline']).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(['staff', 'admin']);
  if ('error' in auth) return auth.error;
  const parsed = createResponder.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Responder name and unit are required.');
  const { data, error } = await auth.supabase.from('responders').insert({
    name: parsed.data.name,
    lead_name: parsed.data.leadName ?? null,
    unit: parsed.data.unit,
    contact_number: parsed.data.contactNumber ?? null,
    current_location: parsed.data.currentLocation ?? null,
    availability: parsed.data.availability ?? 'available',
  }).select(SELECT).single();
  if (error) return badRequest('Unable to add responder.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
