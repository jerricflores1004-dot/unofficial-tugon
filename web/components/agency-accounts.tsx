'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, TriangleAlert, UserX } from 'lucide-react';

type Agency = 'bfp' | 'pnp' | 'coast_guard';
type Account = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  agency: Agency | null;
  is_active: boolean;
};

const AGENCIES: { value: Agency; label: string }[] = [
  { value: 'bfp', label: 'Bureau of Fire Protection (BFP)' },
  { value: 'pnp', label: 'Philippine National Police (PNP)' },
  { value: 'coast_guard', label: 'Philippine Coast Guard' },
];

const emptyForm = { full_name: '', email: '', phone: '', password: '' };
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-navy outline-none focus:border-blue dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export function AgencyAccounts() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState<Agency | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency-accounts', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Unable to load agency accounts.');
      setAccounts(json.data ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load agency accounts.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openForm(agency: Agency) {
    setCreating(agency);
    setForm(emptyForm);
    setFormError('');
  }

  function closeForm() {
    setCreating(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!creating) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/agency-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, agency: creating }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Unable to create the account.');
      closeForm();
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Unable to create the account.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="surface p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-navy dark:text-white">Agency accounts</h3>
        <p className="mt-1 text-xs text-slate-500">One sign-in account per agency. These receive dispatches in the responder workspace.</p>
      </div>
      <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-blue dark:border-slate-700">Refresh</button>
    </div>

    {error && <div role="alert" className="mb-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      <TriangleAlert size={16} className="shrink-0" />{error}
    </div>}

    {accounts === null && !error && <p className="text-xs text-slate-500">Loading agency accounts...</p>}

    {accounts && <div className="grid gap-3 md:grid-cols-3">
      {AGENCIES.map((agency) => {
        const account = accounts.find((item) => item.agency === agency.value);
        return <div key={agency.value} className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{agency.label}</p>
          {account
            ? <div className="mt-2 space-y-1">
              <p className="text-sm font-bold text-navy dark:text-white">{account.full_name}</p>
              <p className="truncate text-xs text-slate-500">{account.email ?? 'No email on file'}</p>
              <p className="text-xs text-slate-500">{account.phone || 'No phone on file'}</p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${account.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {account.is_active ? <ShieldCheck size={12} /> : <UserX size={12} />}
                {account.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            : creating === agency.value
              ? <form onSubmit={submit} className="mt-3 space-y-2">
                <input className={inputClass} placeholder="Account name (e.g. BFP Mabini)" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                <input className={inputClass} type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <input className={inputClass} type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className={inputClass} type="password" placeholder="Temporary password (min. 8 characters)" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                {formError && <p role="alert" className="text-[11px] text-red-600 dark:text-red-300">{formError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">{saving ? 'Creating...' : 'Create account'}</button>
                  <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:border-slate-700">Cancel</button>
                </div>
              </form>
              : <div className="mt-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">No account yet.</p>
                <button type="button" onClick={() => openForm(agency.value)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-blue hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <Plus size={12} />Create account
                </button>
              </div>}
        </div>;
      })}
    </div>}
  </section>;
}