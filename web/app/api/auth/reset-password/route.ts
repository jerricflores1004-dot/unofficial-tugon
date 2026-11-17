import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';
import { resolveAppUrl } from '@/lib/app-url';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${resolveAppUrl(request)}/reset-password`,
  });
  if (error) {
    console.error('RESET PASSWORD ERROR:', error.message);
    return NextResponse.json({ error: 'Unable to send reset instructions.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
