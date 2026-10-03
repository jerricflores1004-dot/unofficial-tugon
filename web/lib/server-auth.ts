import { NextResponse } from 'next/server';
import type { Role } from './types';
import { createServerSupabase } from './supabase-server';

export async function requireRole(roles: Role[] = []) {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 }) } as const;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  const { data: profile, error: profileError } = await supabase.from('users').select('id, full_name, role, barangay, is_active').eq('id', user.id).single();
  if (profileError || !profile || !profile.is_active) return { error: NextResponse.json({ error: 'Active user profile required.' }, { status: 403 }) } as const;
  if (roles.length && !roles.includes(profile.role as Role)) return { error: NextResponse.json({ error: 'You do not have permission for this operation.' }, { status: 403 }) } as const;
  return { supabase, user, profile } as const;
}

export function badRequest(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
