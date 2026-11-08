import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

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