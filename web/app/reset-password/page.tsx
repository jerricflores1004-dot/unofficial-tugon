'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Shield, TriangleAlert } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { describeError } from '@/lib/api-client';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Landing page for the Supabase recovery link.
 *
 * Supabase puts the recovery token in the URL hash
 * (`#access_token=...&type=recovery`). The browser client picks that up and
 * creates the session, then `updateUser` stores the new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [databaseReady, setDatabaseReady] = useState<boolean | null>(
    isSupabaseConfigured ? true : null
  );

  useEffect(() => {
    if (isSupabaseConfigured) return;
    let cancelled = false;
    void fetch('/api/config', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { supabaseConfigured?: boolean } | null) => {
        if (!cancelled) setDatabaseReady(Boolean(data?.supabaseConfigured));
      })
      .catch(() => {
        if (!cancelled) setDatabaseReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read the recovery token after mount: touching `window` during render
  // would make the server and client markup disagree.
  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    setHasRecoveryToken(
      hash.get('type') === 'recovery' ||
        hash.has('access_token') ||
        query.has('code') ||
        query.get('error') !== null
    );
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');

    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (!client) {
      setError('Authentication service is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      await client.auth.signOut();
      setTimeout(() => {
        router.replace('/login');
        router.refresh();
      }, 2500);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'The password could not be updated. Request a new reset link.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas p-4 dark:bg-[#111827] sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-lg flex-col justify-center rounded-3xl border border-white/70 bg-[#f1f5f9] p-8 shadow-neumorphic dark:border-slate-700 dark:bg-[#1f2937] dark:shadow-neumorphic-dark sm:p-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white">
            <Shield size={20} />
          </span>
          <div>
            <p className="text-lg font-bold tracking-[.18em] text-navy dark:text-white">TUGON</p>
            <p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">
              MDRRMO Mabini
            </p>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-[.16em] text-blue">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy dark:text-white">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter the new password for your TUGON operations account.
        </p>

        {databaseReady === false && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Database is not configured for this deployment, so passwords cannot be changed here.
          </div>
        )}

        {hasRecoveryToken === false && !done && (
          <div
            role="alert"
            className="mt-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              This page needs the reset link from your email. Open the newest TUGON reset email on
              this device, or request a new link from the sign-in page.
            </span>
          </div>
        )}

        {done ? (
          <div
            role="status"
            className="mt-8 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>Password updated. Taking you to sign in…</span>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              New password
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <KeyRound size={17} className="text-slate-400" />
                <input
                  required
                  minLength={8}
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
                />
              </div>
            </label>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Confirm new password
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <KeyRound size={17} className="text-slate-400" />
                <input
                  required
                  minLength={8}
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  placeholder="Repeat the password"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
                />
              </div>
            </label>

            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                <TriangleAlert size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || databaseReady !== true}>
              {loading ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                <>
                  Save new password <ArrowRight size={16} />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="font-bold text-blue hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
