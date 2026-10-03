import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';

const SELECT = '*, user:users!user_id(full_name)';

export async function GET(request: Request) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
  const staff = ['staff', 'admin', 'department_head'].includes(auth.profile.role);
  let query = auth.supabase.from('feedback').select(SELECT).order('created_at', { ascending: false }).limit(limit);
  // Residents only ever see their own feedback; RLS enforces the same rule.
  if (!staff) query = query.eq('user_id', auth.user.id);
  const { data, error } = await query;
  if (error) return badRequest('Unable to load feedback.', 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const parsed = z.object({
    incidentId: z.string().uuid().nullable().optional(),
    rating: z.number().int().min(1).max(5),
    message: z.string().max(2000).optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Please provide a rating from one to five.');
  const { data, error } = await auth.supabase.from('feedback').insert({
    user_id: auth.user.id,
    incident_id: parsed.data.incidentId ?? null,
    rating: parsed.data.rating,
    message: parsed.data.message || null,
  }).select(SELECT).single();
  if (error) return badRequest('Unable to submit feedback.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
