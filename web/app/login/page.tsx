'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Database, Eye, EyeOff, LockKeyhole, Mail, Shield, TriangleAlert } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { describeError, request } from '@/lib/api-client';

type Mode = 'signin' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Welcome back',
  reset: 'Reset your password',
};
const SUBTITLES: Record<Mode, string> = {
  signin: 'Sign in to continue to your response workspace.',
  reset: 'Supabase Auth will email you a reset link.',
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setShowPassword(false);
  }

  async function signIn(email: string, password: string) {
    setLoading(true);
    setError('');
    try {
      const result = await request<{ profile?: { role?: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      // The account's role decides where it lands: agency accounts go to their dispatch inbox.
      router.replace(result?.profile?.role === 'department_head' ? '/responder' : '/dashboard');
      router.refresh();
    } catch (cause) {
      setError(describeError(cause));
      setLoading(false);
    }
  }

  async function resetPassword(email: string) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) });
      setNotice('If that address exists in Supabase Auth, reset instructions were sent.');
    } catch (cause) {
      setError(describeError(cause));
    } finally { setLoading(false); }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    if (mode === 'reset') { void resetPassword(email); return; }
    void signIn(email, String(data.get('password') ?? ''));
  }

  return <main className="min-h-screen bg-canvas p-4 dark:bg-[#111827] sm:p-6">
    <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl overflow-hidden rounded-3xl border border-white/70 bg-[#f1f5f9] shadow-neumorphic dark:border-slate-700 dark:bg-[#1f2937] dark:shadow-neumorphic-dark lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full border border-white/10" />
        <div>
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Shield size={23} /><i className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-emergency" /></span>
            <div><p className="text-xl font-bold tracking-[.2em]">TUGON</p><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-blue-200">MDRRMO Mabini</p></div>
          </div>
          <div className="mt-24 max-w-md">
            <p className="mb-5 text-xs font-bold uppercase tracking-[.2em] text-blue-200">Disaster response, together</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Every report moves help closer.</h1>
            <p className="mt-6 text-sm leading-6 text-blue-100/75">A shared operations picture for residents, responders, and the Municipal Disaster Risk Reduction and Management Office of Mabini. Every record is read from the municipal database.</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-xs text-blue-100/70">
          <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />{isSupabaseConfigured ? 'Database connected' : 'Database not configured'}</span>
          <span>Supabase Auth · RLS enforced</span>
        </div>
      </section>

      <section className="flex flex-col justify-center p-6 sm:p-12 lg:p-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white"><Shield size={20} /></span>
              <div><p className="text-lg font-bold tracking-[.18em] text-navy dark:text-white">TUGON</p><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">MDRRMO Mabini</p></div>
            </div>
          </div>

          {!isSupabaseConfigured && <div role="alert" className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <Database size={16} className="mt-0.5 shrink-0" />
            <span><strong>Database not configured.</strong><br />Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then apply the migrations with <code>supabase db push</code>. This workspace has no sample data to fall back on.</span>
          </div>}

          <p className="text-xs font-bold uppercase tracking-[.16em] text-blue">Operations portal</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy dark:text-white">{TITLES[mode]}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{SUBTITLES[mode]}</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Work email
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <Mail size={17} className="text-slate-400" />
                <input required type="email" name="email" autoComplete="email" placeholder="you@municipality.gov.ph" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
              </div>
            </label>

            {mode !== 'reset' && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Password
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <LockKeyhole size={17} className="text-slate-400" />
                <input required minLength={8} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Enter your password" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-blue" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>}

            <div className="flex items-center justify-between">
              {mode === 'signin'
                ? <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" name="remember" className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue" />Remember me</label>
                : <span />}
              <button type="button" onClick={() => switchMode(mode === 'reset' ? 'signin' : 'reset')} className="text-xs font-bold text-blue hover:underline">
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
              </button>
            </div>

            {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><TriangleAlert size={16} className="shrink-0" />{error}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}

            <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured}>
              {loading
                ? <><Spinner /> {mode === 'reset' ? 'Sending…' : 'Signing in…'}</>
                : mode === 'reset' ? <>Send reset link <ArrowRight size={16} /></>
                : <>Sign in <ArrowRight size={16} /></>}
            </Button>
          </form>

          <p className="mt-10 text-center text-[11px] text-slate-400">MDRRMO staff and agency accounts (BFP · PNP · Coast Guard) sign in here. Need access? Contact the TUGON system administrator.</p>
        </div>
      </section>
    </div>
  </main>;
}