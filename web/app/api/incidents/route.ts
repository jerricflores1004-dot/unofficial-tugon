import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

const SELECT = '*, ticket:tickets(ticket_number), reporter:users!reporter_id(full_name, phone), responder:responders!assigned_responder_id(name, unit)';
const filters = z.object({
  status: z.enum(['pending', 'verified', 'responding', 'resolved', 'closed', 'rejected']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export async function GET(request: Request) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 25) || 25, 1), 100);
  const from = Math.max(Number(url.searchParams.get('from') ?? 0) || 0, 0);
  const parsed = filters.safeParse({ status: url.searchParams.get('status') ?? undefined, priority: url.searchParams.get('priority') ?? undefined });
  if (!parsed.success) return badRequest('Unknown status or priority filter.');
  const search = (url.searchParams.get('search') ?? '').replace(/[%_,()]/g, ' ').trim();

  let query = auth.supabase.from('incidents').select(SELECT, { count: 'exact' }).order('reported_at', { ascending: false }).range(from, from + limit - 1);
  if (parsed.data.status) query = query.eq('status', parsed.data.status);
  if (parsed.data.priority) query = query.eq('priority', parsed.data.priority);
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  if (since && !Number.isNaN(Date.parse(since))) query = query.gte('reported_at', new Date(since).toISOString());
  if (until && !Number.isNaN(Date.parse(until))) query = query.lte('reported_at', new Date(until).toISOString());
  if (url.searchParams.get('geolocated') === 'true') query = query.not('latitude', 'is', null).not('longitude', 'is', null);
  if (url.searchParams.get('unassigned') === 'true') query = query.is('assigned_responder_id', null);
  if (search) query = query.or(`incident_type.ilike.%${search}%,barangay.ilike.%${search}%,location_text.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return badRequest('Unable to load incidents.', 500);
  return NextResponse.json({ data: data ?? [], count: count ?? 0, from, limit });
}

const createIncident = z.object({
  type: z.string().min(2).max(80),
  description: z.string().min(10).max(4000),
  location: z.string().min(2).max(240),
  barangay: z.string().min(2).max(100),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  affectedPeople: z.number().int().min(0).max(100000).default(0),
  vulnerableGroups: z.array(z.string().max(40)).max(20).default([]),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(['resident']);
  if ('error' in auth) return auth.error;
  const parsed = createIncident.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Please check the incident details and try again.');
  const data = parsed.data;
  const { data: incident, error } = await auth.supabase.from('incidents').insert({
    reporter_id: auth.user.id,
    incident_type: data.type,
    description: data.description,
    location_text: data.location,
    barangay: data.barangay,
    severity: data.severity,
    affected_people: data.affectedPeople,
    vulnerable_groups: data.vulnerableGroups,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
  }).select('*, ticket:tickets(ticket_number)').single();
  if (error) return badRequest('Unable to submit incident. Please try again.', 500);
  return NextResponse.json({ data: incident }, { status: 201 });
}
