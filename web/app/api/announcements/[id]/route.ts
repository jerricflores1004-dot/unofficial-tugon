import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';

const patch = z.object({
  title: z.string().min(2).max(160).optional(),
  body: z.string().min(2).max(10000).optional(),
  priority: z.enum(['normal', 'important', 'urgent']).optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid announcement update.');
  const values: Record<string, unknown> = {};
  if (parsed.data.title) values.title = parsed.data.title;
  if (parsed.data.body) values.body = parsed.data.body;
  if (parsed.data.priority) values.priority = parsed.data.priority;
  if (parsed.data.expiresAt !== undefined) values.expires_at = parsed.data.expiresAt;
  if (parsed.data.isPublished !== undefined) {
    values.is_published = parsed.data.isPublished;
    if (parsed.data.isPublished) values.published_at = new Date().toISOString();
  }
  if (Object.keys(values).length === 0) return badRequest('Nothing to update.');
  const { data, error } = await auth.supabase.from('announcements').update(values).eq('id', params.id).select('*, publisher:users!published_by(full_name)').single();
  if (error) return badRequest('Unable to update announcement.', 500);
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin', 'department_head']);
  if ('error' in auth) return auth.error;
  const { error } = await auth.supabase.from('announcements').delete().eq('id', params.id);
  if (error) return badRequest('Unable to remove announcement.', 500);
  return NextResponse.json({ ok: true });
}
