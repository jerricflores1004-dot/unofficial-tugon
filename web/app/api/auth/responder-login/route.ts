import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';

// Web responder sign-in is for the agency accounts only (one per agency).
// MDRRMO field staff use the mobile app and cannot sign in here.
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  agency: z.enum(['bfp', 'pnp', 'coast_guard']),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 });
  const { email, password, agency } = body.data;

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, agency, team, barangay, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  // From here on, any refusal also ends the session that was just created,
  // so a rejected account is not left signed in.
  async function refuse(message: string) {
    await supabase!.auth.signOut();
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (profileError || !profile || !profile.is_active) {
    return refuse('An active responder profile is required.');
  }
  if (profile.role !== 'department_head') {
    return refuse('This sign-in is for agency accounts only.');
  }
  if (profile.agency !== agency) {
    return refuse('Your profile is not registered under that agency.');
  }

  return NextResponse.json({ user: data.user, session: data.session, profile });
}