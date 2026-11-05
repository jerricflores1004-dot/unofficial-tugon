
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Role,
  ResponderAgency,
  ResponderTeam,
} from './types';
import { createServerSupabase } from './supabase-server';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  agency: ResponderAgency | null;
  team: ResponderTeam | null;
  barangay: string | null;
  is_active: boolean;
};

export type AuthFailure = {
  error: NextResponse;
};

export type AuthSuccess = {
  supabase: SupabaseClient;
  user: { id: string };
  profile: Profile;
};

/**
 * Resolves the authenticated Supabase user,
 * retrieves their public.users profile,
 * checks account activation, and enforces roles.
 *
 * Database RLS remains responsible for data authorization.
 */
export async function requireRole(
  roles: Role[] = []
): Promise<AuthFailure | AuthSuccess> {

  // 1. Initialize Supabase server client.
  const supabase = await createServerSupabase();

  if (!supabase) {
    console.error(
      'AUTH ERROR: Supabase environment variables are missing.'
    );

    return {
      error: NextResponse.json(
        {
          error: 'The database connection is not configured.',
        },
        { status: 503 }
      ),
    };
  }

  // 2. Retrieve the authenticated user.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('AUTH ERROR: No authenticated user.', {
      message: userError?.message,
    });

    return {
      error: NextResponse.json(
        {
          error: 'Authentication required. Please sign in again.',
        },
        { status: 401 }
      ),
    };
  }

  // 3. Retrieve the matching application profile.
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      agency,
      team,
      barangay,
      is_active
    `)
    .eq('id', user.id)
    .maybeSingle();

  // 4. Handle database query errors separately.
  if (profileError) {
    console.error('PROFILE QUERY ERROR:', {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
    });

    return {
      error: NextResponse.json(
        {
          error: 'Unable to retrieve your user profile.',
        },
        { status: 500 }
      ),
    };
  }

  // 5. Check whether the application profile exists.
  if (!profile) {
    console.error('PROFILE NOT FOUND:', {
      userId: user.id,
      email: user.email,
    });

    return {
      error: NextResponse.json(
        {
          error: 'Your account has no registered application profile.',
        },
        { status: 403 }
      ),
    };
  }

  // 6. Verify that the account is active.
  if (profile.is_active !== true) {
    console.warn('INACTIVE USER PROFILE:', {
      userId: user.id,
      role: profile.role,
    });

    return {
      error: NextResponse.json(
        {
          error: 'Your application profile is inactive.',
        },
        { status: 403 }
      ),
    };
  }

  // 7. Validate the assigned role.
  const validRoles: Role[] = [
    'resident',
    'staff',
    'admin',
    'department_head',
  ];

  if (!validRoles.includes(profile.role as Role)) {
    console.error('INVALID USER ROLE:', {
      userId: user.id,
      role: profile.role,
    });

    return {
      error: NextResponse.json(
        {
          error: 'Your account has an invalid application role.',
        },
        { status: 403 }
      ),
    };
  }

  // 8. Enforce role restrictions when requested.
  if (
    roles.length > 0 &&
    !roles.includes(profile.role as Role)
  ) {
    console.warn('ROLE ACCESS DENIED:', {
      userId: user.id,
      userRole: profile.role,
      requiredRoles: roles,
    });

    return {
      error: NextResponse.json(
        {
          error: 'You do not have permission for this operation.',
        },
        { status: 403 }
      ),
    };
  }

  // 9. Authentication and profile validation successful.
  return {
    supabase,
    user: {
      id: user.id,
    },
    profile: profile as Profile,
  };
}

/**
 * Standard API error response helper.
 */
export function badRequest(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      error: message,
    },
    { status }
  );
}
