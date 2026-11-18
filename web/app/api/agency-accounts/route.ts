import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const AGENCIES = ['bfp', 'pnp', 'coast_guard'] as const;

export async function GET() {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data, error } = await admin
    .from('users')
    .select('id, email, full_name, phone, agency, is_active')
    .eq('role', 'department_head')
    .order('agency', { ascending: true });

  if (error) return badRequest('Unable to load agency accounts.', 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const body = await request.json().catch(() => null);
  const agency = body?.agency;
  const email = String(body?.email ?? '').trim().toLowerCase();
  const fullName = String(body?.full_name ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  const password = String(body?.password ?? '');

  if (!(AGENCIES as readonly string[]).includes(agency)) {
    return badRequest('Choose a valid agency.');
  }
  if (!fullName) return badRequest('Account name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest('Enter a valid email address.');
  }
  if (password.length < 8) {
    return badRequest('Password must be at least 8 characters.');
  }

  // One account per agency.
  const { data: existing, error: lookupError } = await admin
    .from('users')
    .select('id')
    .eq('role', 'department_head')
    .eq('agency', agency)
    .limit(1);
  if (lookupError) return badRequest('Unable to verify existing accounts.', 500);
  if (existing && existing.length > 0) {
    return badRequest('This agency already has an account.', 409);
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created.error || !created.data.user) {
    const message = created.error?.message ?? '';
    if (/already|registered|exists/i.test(message)) {
      return badRequest('That email is already registered.', 409);
    }
    return badRequest('Unable to create the account.', 500);
  }

  const userId = created.data.user.id;

  const { error: profileError } = await admin.from('users').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      phone: phone || null,
      role: 'department_head',
      agency,
      is_active: true,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    // Roll back so we never leave a sign-in without a profile.
    await admin.auth.admin.deleteUser(userId);
    return badRequest('Unable to save the agency profile.', 500);
  }

  return NextResponse.json(
    {
      data: {
        id: userId,
        email,
        full_name: fullName,
        phone: phone || null,
        agency,
        is_active: true,
      },
    },
    { status: 201 },
  );
}