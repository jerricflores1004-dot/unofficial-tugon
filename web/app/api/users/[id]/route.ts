import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';

const SELECT = 'id, email, full_name, role, barangay, is_active, created_at';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({
    fullName: z.string().min(2).max(120).optional(),
    role: z.enum(['resident', 'staff', 'admin', 'department_head']).optional(),
    barangay: z.string().max(100).nullable().optional(),
    isActive: z.boolean().optional(),
  }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid user update.');

  const values: Record<string, unknown> = {};
  if (parsed.data.fullName) values.full_name = parsed.data.fullName;
  if (parsed.data.role) values.role = parsed.data.role;
  if (parsed.data.barangay !== undefined) values.barangay = parsed.data.barangay;
  if (parsed.data.isActive !== undefined) values.is_active = parsed.data.isActive;
  if (Object.keys(values).length === 0) return badRequest('Nothing to update.');
  if (parsed.data.isActive === false && params.id === auth.user.id) {
    return badRequest('You cannot deactivate your own account.');
  }

  const { data, error } = await auth.supabase.from('users').update(values).eq('id', params.id).select(SELECT).single();
  if (error) return badRequest('Unable to update user.', 500);
  return NextResponse.json({ data });
}

/** Deactivation only — the auth identity and its audit trail are preserved. */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  if (params.id === auth.user.id) return badRequest('You cannot deactivate your own account.');
  const { error } = await auth.supabase.from('users').update({ is_active: false }).eq('id', params.id);
  if (error) return badRequest('Unable to deactivate user.', 500);
  return NextResponse.json({ ok: true });
}
