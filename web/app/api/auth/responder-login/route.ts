import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  agency: z.enum(['bfp', 'pnp', 'coast_guard', 'mdrrmo']),
  // MDRRMO responders must name their field team (alpha, bravo, charlie).
  // Other agencies do not use MDRRMO field teams.
  team: z.enum(['alpha', 'bravo', 'charlie']).optional(),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 });
  const { email, password, agency, team } = body.data;

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, agency, team, barangay, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !profile || !profile.is_active) {
    return NextResponse.json({ error: 'An active responder profile is required.' }, { status: 403 });
  }

  // The profile must belong to the agency the responder signed in as, and an
  // MDRRMO account must match its field team. Other agencies carry no team.
  if (profile.agency !== agency) {
    return NextResponse.json({ error: 'Your profile is not registered under that agency.' }, { status: 403 });
  }
  if (agency === 'mdrrmo' ? profile.team !== team : profile.team !== null) {
    return NextResponse.json({ error: 'Your profile is not registered under that field team.' }, { status: 403 });
  }

  return NextResponse.json({ user: data.user, session: data.session, profile });
}
