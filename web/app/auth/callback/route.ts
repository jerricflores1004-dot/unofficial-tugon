
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const cookieStore = await cookies();

  let response = NextResponse.redirect(new URL(next, origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL('/login?error=configuration', origin)
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string): string | undefined {
          return cookieStore.get(name)?.value;
        },

        set(
          name: string,
          value: string,
          options: CookieOptions
        ): void {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        },

        remove(
          name: string,
          options: CookieOptions
        ): void {
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL('/login?error=auth', origin)
      );
    }
  }

  return response;
}
