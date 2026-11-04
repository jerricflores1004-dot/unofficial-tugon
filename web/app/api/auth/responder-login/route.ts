import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  agency: z.enum(['bfp', 'pnp', 'coast_guard', 'mdrrmo']),
  // MDRRMO responders must name their field team (alpha, bravo, charlie).
  // Other agencies do not use MDRRMO field teams and send no team at all
  // (null or an empty string), which must pass validation rather than fail it.
  team: z.preprocess((value) => (value === '' ? null : value), z.enum(['alpha', 'bravo', 'charlie']).nullish()),
}).superRefine((value, ctx) => {
  if (value.agency === 'mdrrmo' && !value.team) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['team'], message: 'MDRRMO sign-in requires a field team.' });
  }
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 });
  const { email, password, agency } = body.data;
  const team = body.data.team ?? null;

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, agency, team, barangay, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  // A failed query (for example a database without the responder migrations)
  // is not the same as a missing or inactive profile, so each case reports its
  // own explanation instead of one misleading message.
  if (profileError) {
    console.error('responder-login: profile lookup failed:', profileError.message);
    return NextResponse.json({ error: 'Unable to verify your responder profile. Ask the TUGON system administrator to confirm the database migrations are applied.' }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'No user profile exists for this account. Ask the TUGON system administrator to create your responder profile.' }, { status: 403 });
  }
  if (!profile.is_active) {
    return NextResponse.json({ error: 'Your account has been deactivated. Contact the TUGON system administrator.' }, { status: 403 });
  }

  // The profile must belong to the agency the responder signed in as, and an
  // MDRRMO account must match its field team. Other agencies carry no team.
  if (profile.agency !== agency) {
    return NextResponse.json({ error: 'Your profile is not registered under that agency. Ask the TUGON system administrator to assign your responder agency.' }, { status: 403 });
  }
  const expectedTeam = agency === 'mdrrmo' ? team : null;
  if (profile.team !== expectedTeam) {
    if (agency === 'mdrrmo') {
      return NextResponse.json({ error: 'Your profile is not registered under that field team. Ask the TUGON system administrator to assign your MDRRMO field team.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Your profile still carries an MDRRMO field team. Ask the TUGON system administrator to correct your profile.' }, { status: 403 });
  }

  return NextResponse.json({ user: data.user, session: data.session, profile });
}
