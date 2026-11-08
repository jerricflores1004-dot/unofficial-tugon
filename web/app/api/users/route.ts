import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const SELECT = 'id, email, full_name, role, agency, team, barangay, is_active, created_at';

export async function GET() {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('users').select(SELECT).order('created_at', { ascending: false });
  if (error) return badRequest('Unable to load users.', 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120),
    role: z.enum(['resident', 'staff', 'admin', 'department_head']),
    agency: z.enum(['bfp', 'pnp', 'coast_guard', 'mdrrmo']).nullable().optional(),
    team: z.enum(['alpha', 'bravo', 'charlie']).nullable().optional(),
    barangay: z.string().max(100).nullable().optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid user details.');
  if (parsed.data.team != null && parsed.data.agency !== 'mdrrmo') {
    return badRequest('A field team can only be assigned to MDRRMO profiles.');
  }

  const admin = createAdminClient();
  if (!admin) return badRequest('Server user provisioning is not configured.', 503);
  // The account is created without a password; Supabase Auth sends the invite so
  // no credential ever exists in this codebase or in the database seed.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: false,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (createError || !created.user) return badRequest('Unable to create user.', 400);

  const { data, error } = await admin.from('users').update({
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    agency: parsed.data.agency ?? null,
    // A field team is only meaningful for MDRRMO profiles.
    team: parsed.data.agency === 'mdrrmo' ? (parsed.data.team ?? null) : null,
    barangay: parsed.data.barangay ?? null,
  }).eq('id', created.user.id).select(SELECT).single();
  if (error) return badRequest('User was created but profile setup failed. Review the audit log.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
