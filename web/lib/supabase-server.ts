
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createServerClient(url, key, {
    cookies: {
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value;
      },

      set(
        name: string,
        value: string,
        options: CookieOptions
      ): void {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Cookie updates may not be available in Server Components.
          // Middleware should handle session refresh when applicable.
        }
      },

      remove(
        name: string,
        options: CookieOptions
      ): void {
        try {
          cookieStore.set(name, '', {
            ...options,
            maxAge: 0,
          });
        } catch {
          // Cookie updates may not be available in Server Components.
        }
      },
    },
  });
}
