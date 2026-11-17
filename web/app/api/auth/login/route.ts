import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';
import { isWebRole } from '@/lib/web-access';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  // Unticked "Remember me" gives a session that ends with the browser.
  remember: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
  }

  const { email, password, remember } = body.data;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.error('LOGIN ERROR:', error.message);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active || !isWebRole(profile.role)) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'This portal is for MDRRMO staff. Residents, please use the TUGON mobile app.' },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ user: data.user, session: data.session });

  if (!remember) {
    // Drop the max-age from every Supabase cookie so it becomes a session
    // cookie: the user is signed out when the browser closes.
    for (const cookie of response.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.set(cookie.name, cookie.value, { ...cookie, maxAge: undefined });
      }
    }
  }

  return response;
}
