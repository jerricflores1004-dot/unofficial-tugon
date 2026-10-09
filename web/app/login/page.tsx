'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Database, Eye, EyeOff, LockKeyhole, Mail, Phone, Shield, TriangleAlert, User } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { describeError, request } from '@/lib/api-client';

type Mode = 'signin' | 'register' | 'reset';

const TITLES: Record<Mode, string> = { signin: 'Welcome back', register: 'Create your account', reset: 'Reset your password' };
const SUBTITLES: Record<Mode, string> = {
  signin: 'Sign in to continue to your response workspace.',
  register: 'Register with your name and email. Staff roles are assigned by the TUGON system administrator.',
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
      await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(describeError(cause));
      setLoading(false);
    }
  }

  async function register(input: { fullName: string; email: string; phone: string; password: string }) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await request<{ session?: unknown | null }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: input.fullName,
          email: input.email,
          password: input.password,
          // Omit an empty phone so the server's optional-but-min-length rule is not triggered.
          ...(input.phone ? { phone: input.phone } : {}),
        }),
      });
      if (result?.session) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }
      // Email confirmation is enabled in Supabase Auth: no session yet.
      setLoading(false);
      switchMode('signin');
      setNotice('Account created. Check your email to confirm your address, then sign in.');
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
    if (mode === 'register') {
      const password = String(data.get('password') ?? '');
      const confirmPassword = String(data.get('confirmPassword') ?? '');
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      void register({
        fullName: String(data.get('fullName') ?? '').trim(),
        email,
        phone: String(data.get('phone') ?? '').trim(),
        password,
      });
      return;
    }
    void signIn(email, String(data.get('password') ?? ''));
  }

  const isRegister = mode === 'register';

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
            {isRegister && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <User size={17} className="text-slate-400" />
                <input required minLength={2} maxLength={120} type="text" name="fullName" autoComplete="name" placeholder="Juan Dela Cruz" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
              </div>
            </label>}

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{isRegister ? 'Email' : 'Work email'}
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <Mail size={17} className="text-slate-400" />
                <input required type="email" name="email" autoComplete="email" placeholder={isRegister ? 'you@example.com' : 'you@municipality.gov.ph'} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
              </div>
            </label>

            {isRegister && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Phone <span className="font-normal text-slate-400">(optional)</span>
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <Phone size={17} className="text-slate-400" />
                <input type="tel" name="phone" minLength={7} maxLength={30} autoComplete="tel" placeholder="09XX XXX XXXX" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
              </div>
            </label>}

            {mode !== 'reset' && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Password
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <LockKeyhole size={17} className="text-slate-400" />
                <input required minLength={8} type={showPassword ? 'text' : 'password'} name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-blue" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>}

            {isRegister && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm password
              <div className="inset-control mt-2 flex items-center gap-2 px-3">
                <LockKeyhole size={17} className="text-slate-400" />
                <input required minLength={8} type={showPassword ? 'text' : 'password'} name="confirmPassword" autoComplete="new-password" placeholder="Re-enter your password" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" />
              </div>
            </label>}

            {mode !== 'register' && <div className="flex items-center justify-between">
              {mode === 'signin'
                ? <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" name="remember" className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue" />Remember me</label>
                : <span />}
              <button type="button" onClick={() => switchMode(mode === 'reset' ? 'signin' : 'reset')} className="text-xs font-bold text-blue hover:underline">
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
              </button>
            </div>}

            {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><TriangleAlert size={16} className="shrink-0" />{error}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}

            <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured}>
              {loading
                ? <><Spinner /> {mode === 'reset' ? 'Sending…' : isRegister ? 'Creating account…' : 'Signing in…'}</>
                : mode === 'reset' ? <>Send reset link <ArrowRight size={16} /></>
                : isRegister ? <>Create account <ArrowRight size={16} /></>
                : <>Sign in <ArrowRight size={16} /></>}
            </Button>
          </form>

          {mode !== 'reset' && <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {isRegister ? 'Already have an account? ' : 'New to TUGON? '}
            <button type="button" onClick={() => switchMode(isRegister ? 'signin' : 'register')} className="font-bold text-blue hover:underline">
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>}

          <p className="mt-10 text-center text-[11px] text-slate-400">{isRegister ? 'Staff access is granted by the TUGON system administrator.' : 'Need access? Contact the TUGON system administrator.'}</p>
        </div>
      </section>
    </div>
  </main>;
}
