import { NextResponse } from 'next/server';
import { badRequest, requireRole } from '@/lib/server-auth';

/**
 * Identity, navigation counters, and service configuration for the workspace
 * shell. Every value comes from the database or from server-side environment
 * configuration — nothing is baked into the client bundle.
 */
export async function GET() {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase.rpc('workspace_summary');
  if (error) return badRequest('Unable to load the workspace summary.', 500);
  const summary = (data || {}) as Record<string, unknown>;

  const databaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  // Verify the private photo bucket is actually reachable for this session
  // instead of asserting a status the server has not checked.
  const { error: storageError } = await auth.supabase.storage.from('incident-photos').list('', { limit: 1 });

  return NextResponse.json({
    data: {
      profile: {
        id: auth.profile.id,
        email: auth.profile.email ?? '',
        full_name: auth.profile.full_name ?? '',
        role: auth.profile.role,
        barangay: auth.profile.barangay ?? null,
        is_active: auth.profile.is_active !== false,
      },
      role: summary.role ?? auth.profile.role,
      is_staff: summary.is_staff === true,
      attention_incidents: Number(summary.attention_incidents ?? 0),
      unread_notifications: Number(summary.unread_notifications ?? 0),
      integrations: {
        database: databaseConfigured,
        realtime: databaseConfigured,
        storage: databaseConfigured && !storageError,
        push: Boolean(process.env.FIREBASE_SERVER_KEY),
        maps: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
      },
    },
  });
}
