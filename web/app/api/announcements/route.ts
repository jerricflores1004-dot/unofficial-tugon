import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';

const SELECT = '*, publisher:users!published_by(full_name)';

export async function GET(request: Request) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
  const isEditor = ['admin', 'department_head'].includes(auth.profile.role);
  const includeDrafts = isEditor && url.searchParams.get('scope') === 'all';

  let query = auth.supabase.from('announcements').select(SELECT).limit(limit);
  // Everyone else only ever receives published, non-expired announcements.
  if (!includeDrafts) {
    query = query.eq('is_published', true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }
  const { data, error } = await query.order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) return badRequest('Unable to load announcements.', 500);
  return NextResponse.json({ data: data ?? [] });
}

const create = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(2).max(10000),
  priority: z.enum(['normal', 'important', 'urgent']).default('normal'),
  expiresAt: z.string().datetime().nullable().optional(),
  publish: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireRole(['admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid announcement.');
  const { data, error } = await auth.supabase.from('announcements').insert({
    title: parsed.data.title,
    body: parsed.data.body,
    priority: parsed.data.priority,
    published_by: auth.user.id,
    published_at: parsed.data.publish ? new Date().toISOString() : null,
    is_published: parsed.data.publish,
    expires_at: parsed.data.expiresAt ?? null,
  }).select(SELECT).single();
  if (error) return badRequest('Unable to save announcement.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
