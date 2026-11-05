
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
          // Server Components cannot always modify cookies.
          // Middleware can handle session refresh.
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
          // Cookie updates may not be available here.
        }
      },
    },
  });
}
