import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from './types';
import { createServerSupabase } from './supabase-server';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  barangay: string | null;
  is_active: boolean;
};

export type AuthFailure = { error: NextResponse };
export type AuthSuccess = { supabase: SupabaseClient; user: { id: string }; profile: Profile };

/**
 * Resolves the Supabase session, loads the matching `public.users` profile, and
 * enforces the role list. Authorization ultimately rests on RLS; this guard
 * only decides whether a handler should run at all.
 */
export async function requireRole(roles: Role[] = []): Promise<AuthFailure | AuthSuccess> {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: 'The database connection is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
        { status: 503 }
      ),
    };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, barangay, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || !profile.is_active) {
    return { error: NextResponse.json({ error: 'An active user profile is required.' }, { status: 403 }) };
  }
  if (roles.length && !roles.includes(profile.role as Role)) {
    return { error: NextResponse.json({ error: 'You do not have permission for this operation.' }, { status: 403 }) };
  }

  return { supabase, user: { id: user.id }, profile: profile as Profile };
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
