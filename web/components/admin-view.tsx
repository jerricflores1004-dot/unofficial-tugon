'use client';

import { useMemo, useState } from 'react';
import { Database, FileClock, Gauge, HardDrive, LockKeyhole, Plus, Server, UserCog, Users, X, type LucideIcon } from 'lucide-react';
import { describeError, sendResource } from '@/lib/api-client';
import { useApi, useApiGroup } from '@/lib/use-api';
import { mapAuditLog, mapUser, agencyLabel, teamLabel } from '@/lib/mappers';
import { relativeTime } from '@/lib/format';
import type { Pulse, UserRecord, WorkspaceSummary } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

export function AdminView() {
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');
  const isAdmin = workspace.data?.profile?.role === 'admin';
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const data = useApiGroup<{ users: Record<string, any>[]; logs: Record<string, any>[]; pulse: Pulse }>({
    users: isAdmin ? '/api/users' : null,
    logs: isAdmin ? buildLogsPath() : null,
    pulse: isAdmin ? '/api/analytics/operations-pulse' : null,
  });

  const users = useMemo(() => (data.data.users ?? []).map(mapUser), [data.data.users]);
  const logs = useMemo(() => (data.data.logs ?? []).map(mapAuditLog), [data.data.logs]);
  const pulse = data.data.pulse;

  if (workspace.loading) return <div className="space-y-4">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-24 w-full rounded-2xl" />)}</div>;
  if (!isAdmin) return <ErrorState title="Administrator access required" detail="Your database profile does not carry the admin role, so user administration and the audit log are not readable." />;

  const failure = data.errors.users || data.errors.logs || data.errors.pulse;
  if (failure && users.length === 0 && logs.length === 0) return <ErrorState detail={failure} onRetry={data.reload} />;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MiniStat icon={Users} label="Active users" value={pulse?.users_active ?? 0} accent="blue" loading={data.loading} detail={`${pulse?.users_total ?? 0} profiles in public.users`} />
      <MiniStat icon={FileClock} label="Audit events" value={pulse?.audit_events ?? 0} accent="amber" loading={data.loading} detail={`${pulse?.audit_events_24h ?? 0} in the last 24 hours`} />
      <MiniStat icon={Database} label="Deactivated accounts" value={pulse?.users_deactivated ?? 0} accent="red" loading={data.loading} detail="Profiles with is_active = false" />
      <MiniStat icon={Server} label="Registered devices" value={pulse?.notification_devices ?? 0} accent="green" loading={data.loading} detail="FCM tokens stored per user" />
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div className="surface overflow-hidden">
        <div className="border-b border-slate-200/70 p-5 dark:border-slate-700">
          <PanelHeader title="User administration" detail={data.loading ? 'Loading profiles…' : `${users.length} profiles provisioned by Supabase Auth`} action={<Button size="sm" onClick={() => setInviting(true)}><Plus size={14} /> Invite user</Button>} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-100/70 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-slate-900/40">
              <tr><th className="px-5 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Responder agency</th><th className="px-3 py-3">Barangay</th><th className="px-3 py-3">Access</th><th className="px-5 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
              {data.loading && users.length === 0
                ? [0, 1, 2].map((row) => <tr key={row}><td colSpan={6} className="px-5 py-3"><LoadingSkeleton className="h-9 w-full" /></td></tr>)
                : users.map((user) => <UserRow key={user.id} user={user} onChanged={() => { data.reload(); }} onToast={setToast} />)}
            </tbody>
          </table>
          {!data.loading && users.length === 0 && <div className="p-6"><EmptyState title="No user profiles" detail="Profiles are created automatically when Supabase Auth registers an account." /></div>}
        </div>
      </div>

      <div className="surface p-5">
        <PanelHeader title="Security posture" detail="Reported by the server for this session" />
        <div className="space-y-3">
          <SecurityRow icon={LockKeyhole} label="Row level security" value={workspace.data?.integrations.database ? 'Enforced by Postgres' : 'Unavailable'} good={Boolean(workspace.data?.integrations.database)} />
          <SecurityRow icon={HardDrive} label="Photo storage" value={workspace.data?.integrations.storage ? 'Private bucket reachable' : 'Not reachable'} good={Boolean(workspace.data?.integrations.storage)} />
          <SecurityRow icon={Gauge} label="Push delivery" value={workspace.data?.integrations.push ? 'Server key configured' : 'Key not set'} good={Boolean(workspace.data?.integrations.push)} />
          <SecurityRow icon={UserCog} label="Your role" value={workspace.data?.profile?.role ?? 'unknown'} good={isAdmin} />
        </div>
        <p className="mt-4 text-[10px] leading-4 text-slate-400">Role checks in the API are a convenience layer; the database policies make the final authorization decision.</p>
      </div>
    </div>

    <div className="surface overflow-hidden">
      <div className="border-b border-slate-200/70 p-5 dark:border-slate-700">
        <PanelHeader title="Recent audit activity" detail="Immutable events from public.system_logs" action={<Button variant="ghost" size="sm" onClick={data.reload}>Refresh</Button>} />
      </div>
      {data.loading && logs.length === 0
        ? <div className="space-y-2 p-5">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-12 w-full" />)}</div>
        : logs.length === 0
          ? <div className="p-6"><EmptyState title="No audit events" detail="Incident inserts and updates write to the audit log automatically." /></div>
          : logs.slice(0, 12).map((log) => <div key={log.id} className="flex items-center gap-3 border-b border-slate-200/70 p-4 last:border-0 dark:border-slate-700">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/50 dark:text-blue-300"><FileClock size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{log.action} · {log.entity_type}</p>
              <p className="mt-1 truncate text-[10px] text-slate-500">{log.actor}{log.metadata && Object.keys(log.metadata).length > 0 ? ` · ${Object.entries(log.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(', ')}` : ''}</p>
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(log.created_at)}</span>
          </div>)}
    </div>

    {inviting && <InvitePanel onClose={() => setInviting(false)} onCreated={(message) => { setInviting(false); setToast(message); data.reload(); }} />}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function buildLogsPath() { return '/api/logs?limit=50'; }

const AGENCY_CHOICES: { value: UserRecord['agency']; label: string }[] = [
  { value: null, label: 'No agency' },
  { value: 'bfp', label: 'BFP' },
  { value: 'pnp', label: 'PNP' },
  { value: 'coast_guard', label: 'Coast Guard' },
  { value: 'mdrrmo', label: 'MDRRMO Mabini' },
];

const TEAM_CHOICES: { value: UserRecord['team']; label: string }[] = [
  { value: null, label: 'No team' },
  { value: 'alpha', label: 'Team Alpha' },
  { value: 'bravo', label: 'Team Bravo' },
  { value: 'charlie', label: 'Team Charlie' },
];

function UserRow({ user, onChanged, onToast }: { user: UserRecord; onChanged: () => void; onToast: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function changeRole(role: UserRecord['role']) {
    setBusy(true);
    try {
      await sendResource(`/api/users/${user.id}`, 'PATCH', { role });
      onToast(`${user.full_name} is now ${role.replace('_', ' ')}.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }
  async function changeAgency(agency: UserRecord['agency']) {
    setBusy(true);
    try {
      await sendResource(`/api/users/${user.id}`, 'PATCH', { agency });
      onToast(agency
        ? `${user.full_name} is now registered under ${agencyLabel(agency)}${agency === 'mdrrmo' ? '. Assign a field team to finish.' : '.'}`
        : `${user.full_name} no longer carries a responder agency.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }
  async function changeTeam(team: UserRecord['team']) {
    setBusy(true);
    try {
      await sendResource(`/api/users/${user.id}`, 'PATCH', { agency: 'mdrrmo', team });
      onToast(team ? `${user.full_name} is now on ${teamLabel(team)}.` : `${user.full_name} has no MDRRMO field team.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }
  async function toggleActive() {
    setBusy(true);
    try {
      await sendResource(`/api/users/${user.id}`, 'PATCH', { isActive: !user.is_active });
      onToast(`${user.full_name} is now ${user.is_active ? 'deactivated' : 'active'}.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }
  return <tr className="transition-colors hover:bg-white/50 dark:hover:bg-slate-800/40">
    <td className="px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-soft text-[10px] font-bold text-blue dark:bg-blue-950/50 dark:text-blue-300">{user.full_name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0"><p className="truncate font-bold text-slate-700 dark:text-slate-200">{user.full_name}</p><p className="truncate text-[10px] text-slate-400">{user.email}</p></div>
      </div>
    </td>
    <td className="px-3 py-3">
      <select value={user.role} disabled={busy} onChange={(event) => void changeRole(event.target.value as UserRecord['role'])} aria-label={`Role for ${user.full_name}`} className="rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-slate-600 outline-none dark:border-slate-700 dark:text-slate-300">
        <option value="resident">resident</option>
        <option value="staff">staff</option>
        <option value="department_head">department_head</option>
        <option value="admin">admin</option>
      </select>
    </td>
    <td className="px-3 py-3">
      <select value={user.agency ?? ''} disabled={busy} onChange={(event) => void changeAgency((event.target.value || null) as UserRecord['agency'])} aria-label={`Responder agency for ${user.full_name}`} className="rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-slate-600 outline-none dark:border-slate-700 dark:text-slate-300">
        {AGENCY_CHOICES.map((option) => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}
      </select>
      {user.agency === 'mdrrmo' && <select value={user.team ?? ''} disabled={busy} onChange={(event) => void changeTeam((event.target.value || null) as UserRecord['team'])} aria-label={`Field team for ${user.full_name}`} className="mt-1 block rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-slate-600 outline-none dark:border-slate-700 dark:text-slate-300">
        {TEAM_CHOICES.map((option) => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}
      </select>}
    </td>
    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{user.barangay || <span className="italic text-slate-400">Not set</span>}</td>
    <td className="px-3 py-3">
      <button onClick={toggleActive} disabled={busy} className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${user.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{user.is_active ? 'Active' : 'Deactivated'}
      </button>
    </td>
    <td className="px-5 py-3 text-slate-500">{relativeTime(user.created_at)}</td>
  </tr>;
}

function SecurityRow({ icon: Icon, label, value, good }: { icon: LucideIcon; label: string; value: string; good?: boolean }) {
  return <div className="flex items-center gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300"><Icon size={15} /></span>
    <span className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
    <span className={`text-[11px] font-bold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</span>
  </div>;
}

function InvitePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRecord['role']>('staff');
  const [agency, setAgency] = useState<UserRecord['agency']>(null);
  const [team, setTeam] = useState<UserRecord['team']>(null);
  const [barangay, setBarangay] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await sendResource('/api/users', 'POST', {
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        agency,
        team: agency === 'mdrrmo' ? team : null,
        barangay: barangay.trim() || null,
      });
      onCreated(`${fullName.trim()} was created. Supabase Auth handles the password.`);
    } catch (cause) { setFailure(describeError(cause)); } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-white bg-[#f1f5f9] p-6 shadow-2xl dark:border-slate-700 dark:bg-[#1f2937]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <PanelHeader title="Invite user" detail="Creates the auth account and its profile row. No password is ever stored here." />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-navy" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" /></label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" /></label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Role
          <select value={role} onChange={(event) => setRole(event.target.value as UserRecord['role'])} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
            <option value="resident">resident</option><option value="staff">staff</option><option value="department_head">department_head</option><option value="admin">admin</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Barangay<input value={barangay} onChange={(event) => setBarangay(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" /></label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Responder agency
          <select value={agency ?? ''} onChange={(event) => {
            const value = (event.target.value || null) as UserRecord['agency'];
            setAgency(value);
            if (value !== 'mdrrmo') setTeam(null);
          }} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
            {AGENCY_CHOICES.map((option) => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">MDRRMO field team
          <select value={team ?? ''} disabled={agency !== 'mdrrmo'} onChange={(event) => setTeam((event.target.value || null) as UserRecord['team'])} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm disabled:opacity-50 dark:text-white">
            {TEAM_CHOICES.map((option) => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}
          </select>
        </label>
      </div>
      {failure && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{failure}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</Button>
      </div>
    </form>
  </div>;
}
