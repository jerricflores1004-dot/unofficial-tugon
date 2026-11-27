import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';
import { isWebRole } from '@/lib/web-access';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 });

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

  const { data, error } = await supabase.auth.signInWithPassword(body.data);
  if (error) console.error('LOGIN ERROR:', error.message);
  if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active || !isWebRole(profile.role)) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'This portal is for MDRRMO staff and agency accounts. Residents, please use the TUGON mobile app.' },
      { status: 403 }
    );
  }

  // The role comes from the profile, so nobody picks a role or agency at sign-in.
  return NextResponse.json({ user: data.user, session: data.session, profile: { role: profile.role } });
}