import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(30).optional(),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: 'Please provide a valid email, password, and name.' },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Authentication service is not configured.' },
      { status: 503 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Application URL is not configured.' },
      { status: 500 }
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: body.data.email,
    password: body.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        full_name: body.data.fullName,
        phone: body.data.phone ?? null,
      },
    },
  });

  if (error) {
    console.error('Registration error:', error.message);

    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      user: data.user,
      session: data.session,
      message: data.session
        ? 'Account created successfully.'
        : 'Account created. Please confirm your email.',
    },
    { status: 201 }
  );
}
