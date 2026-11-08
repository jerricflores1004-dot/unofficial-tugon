import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SetAllCookies } from '@supabase/ssr';
import { isWebRole } from '@/lib/web-access';

const PUBLIC_PREFIXES = ['/login', '/api/auth'];

const PUBLIC_PAGES = ['/', '/about', '/contact'];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PAGES.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  );
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // Allow public pages even when Supabase is not configured.
  if (!url || !key) {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookies: Parameters<SetAllCookies>[0]) {
        cookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only staff-type accounts may use the web portal.
  // Residents use the mobile app.
  let allowed = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    allowed = !!profile?.is_active && isWebRole(profile.role);
  }

  // Allowed users skip the login page.
  if (allowed && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow public pages without authentication.
  if (isPublicPath(pathname)) {
    return response;
  }

  // Protect private management pages.
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Signed in but not allowed on the web (e.g. a resident).
  // API routes are left to requireRole() and RLS, because the mobile
  // app may call them.
  if (!allowed && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(
      new URL('/login?error=unauthorized', request.url)
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};