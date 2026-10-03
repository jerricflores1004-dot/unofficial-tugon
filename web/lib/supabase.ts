import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client.
 *
 * There is no demo/offline fallback: when the project URL or anon key is
 * missing the client is `null` and the workspace surfaces a configuration
 * error instead of rendering sample records.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
