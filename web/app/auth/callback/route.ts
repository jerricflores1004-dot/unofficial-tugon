import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_confirmation_code', siteUrl)
    );
  }

  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL('/login?error=auth_not_configured', siteUrl)
    );
  }

  const response = NextResponse.redirect(
    new URL('/dashboard', siteUrl)
  );

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },

        set(name, value, options) {
          cookieStore.set(name, value, options);

          response.cookies.set(name, value, options);
        },

        remove(name, options) {
          cookieStore.set(name, '', {
            ...options,
            maxAge: 0,
          });

          response.cookies.set(name, '', {
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Confirmation error:', error.message);

    return NextResponse.redirect(
      new URL('/login?error=confirmation_failed', siteUrl)
    );
  }

  return response;
}
