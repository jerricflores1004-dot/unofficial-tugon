'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Check, ChevronDown, Copy, KeyRound, MapPin, MoreHorizontal, Navigation, Pencil, Plus, Power, Trash2, Users, Wifi, X } from 'lucide-react';
import { describeError, sendResource } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

type TeamKey = 'alpha' | 'bravo' | 'charlie';
type FieldTeam = {
  id: string;
  name: string;
  team: TeamKey | null;
  email: string | null;
  contact_number: string | null;
  members: string[];
  status: string;
  is_active: boolean;
  current_incident: { id: string; label: string } | null;
  last_check_in: string | null;
};
type Credentials = { name: string; email: string; password: string; note?: string };
type TeamResult = { team: FieldTeam; tempPassword?: string; sessionsRevoked?: boolean };

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  available: { label: 'Available', dot: 'bg-blue', text: 'text-blue' },
  assigned: { label: 'Assigned', dot: 'bg-purple-500', text: 'text-purple-600' },
  en_route: { label: 'En route', dot: 'bg-amber-500', text: 'text-amber-600' },
  on_scene: { label: 'On scene', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  offline: { label: 'Offline', dot: 'bg-slate-400', text: 'text-slate-500' },
  deactivated: { label: 'Deactivated', dot: 'bg-red-500', text: 'text-red-600' },
};

function stateOf(team: FieldTeam): string {
  if (!team.is_active) return 'deactivated';
  if (team.current_incident && (team.status === 'available' || team.status === 'offline')) return 'assigned';
  return STATUS[team.status] ? team.status : 'offline';
}

function lastSeen(value: string | null): string {
  if (!value) return 'No check-in yet';
  try { return `Checked in ${formatDistanceToNow(parseISO(value), { addSuffix: true })}`; } catch { return 'No check-in yet'; }
}

export function FieldTeamsView() {
  const [filter, setFilter] = useState('all');
  const [panel, setPanel] = useState<{ team: FieldTeam | null } | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const teams = useApi<FieldTeam[]>('/api/field-teams');
  const all = useMemo(() => teams.data ?? [], [teams.data]);
  const list = useMemo(() => (filter === 'all' ? all : all.filter((team) => stateOf(team) === filter)), [all, filter]);

  const active = all.filter((team) => team.is_active);
  const available = active.filter((team) => stateOf(team) === 'available').length;
  const attached = active.filter((team) => team.current_incident).length;

  if (teams.error) return <ErrorState title="Unable to load field teams" detail={teams.error} onRetry={teams.reload} />;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <MiniStat icon={Users} label="Field teams" value={all.length} accent="blue" loading={teams.loading} detail={`${active.length} active`} />
      <MiniStat icon={Wifi} label="Available" value={available} accent="green" loading={teams.loading} detail="Ready to ride along" />
      <MiniStat icon={Navigation} label="On an incident" value={`${attached} / ${active.length}`} accent="amber" loading={teams.loading} detail="Attached to an active incident" />
    </div>

    <div className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-navy dark:text-white">Field staff accounts</h3>
          <p className="mt-1 text-xs text-slate-500">
            {teams.loading ? 'Loading teams...' : `${list.length} of ${all.length} teams shown`}. Shared team logins for MDRRMO observers who ride along with dispatched agencies.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex min-h-10 items-center">
            <span className="sr-only">Status</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="inset-control h-10 min-w-[132px] appearance-none px-3 pr-8 text-xs font-semibold text-slate-600 outline-none dark:text-slate-200">
              <option value="all">All status</option>
              {Object.entries(STATUS).map(([value, style]) => <option key={value} value={value}>{style.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400" />
          </label>
          <Button size="sm" onClick={() => setPanel({ team: null })}>
            <Plus size={15} /> Add field team
          </Button>
        </div>
      </div>

      {teams.loading && all.length === 0
        ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((card) => <LoadingSkeleton key={card} className="h-[190px] w-full rounded-xl" />)}</div>
        : list.length === 0
          ? <div className="p-6"><EmptyState title={all.length === 0 ? 'No field teams yet' : 'No teams match this filter'} detail={all.length === 0 ? 'Create a shared login for each MDRRMO field team. They sign in on the mobile app only.' : 'Try another status.'} action={all.length === 0 ? <Button size="sm" onClick={() => setPanel({ team: null })}><Plus size={14} /> Add field team</Button> : undefined} /></div>
          : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((team) => <TeamCard key={team.id} team={team} onEdit={() => setPanel({ team })} onChanged={teams.reload} onToast={setToast} onCredentials={setCredentials} />)}
          </div>}
    </div>

    {panel && <TeamPanel
      team={panel.team}
      onClose={() => setPanel(null)}
      onDone={(message, creds) => { setPanel(null); setToast(message); if (creds) setCredentials(creds); teams.reload(); }}
    />}
    {credentials && <CredentialsPanel credentials={credentials} onClose={() => setCredentials(null)} />}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function TeamCard({ team, onEdit, onChanged, onToast, onCredentials }: {
  team: FieldTeam;
  onEdit: () => void;
  onChanged: () => void;
  onToast: (message: string) => void;
  onCredentials: (credentials: Credentials) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const state = stateOf(team);
  const style = STATUS[state];

  async function toggleActive() {
    setMenu(false);
    const next = !team.is_active;
    if (!window.confirm(next ? `Reactivate ${team.name}?` : `Deactivate ${team.name}? Their phones will be signed out and they will not be able to log in.`)) return;
    setBusy(true);
    try {
      await sendResource(`/api/field-teams/${team.id}`, 'PATCH', { isActive: next });
      onToast(`${team.name} ${next ? 'reactivated' : 'deactivated'}.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }

  async function resetPassword() {
    setMenu(false);
    if (!window.confirm(`Reset the password for ${team.name}? Every phone using this account will be signed out.`)) return;
    setBusy(true);
    try {
      const result = await sendResource<TeamResult>(`/api/field-teams/${team.id}`, 'PATCH', { resetPassword: true });
      if (result?.tempPassword) {
        onCredentials({
          name: team.name,
          email: team.email ?? '',
          password: result.tempPassword,
          note: result.sessionsRevoked === false ? 'Existing sessions could not be signed out. Run the revoke_user_sessions SQL from setup.' : 'Existing sessions were signed out.',
        });
      }
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }

  async function remove() {
    setMenu(false);
    if (!window.confirm(`Permanently delete ${team.name} and its login? This cannot be undone. Use Deactivate if the team has history.`)) return;
    setBusy(true);
    try {
      await sendResource(`/api/field-teams/${team.id}`, 'DELETE');
      onToast(`${team.name} was deleted.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }

  const memberLabel = `${team.members.length} member${team.members.length === 1 ? '' : 's'}`;

  return <div className={`rounded-xl border border-slate-200 bg-white/35 p-4 dark:border-slate-700 dark:bg-slate-800/30 ${team.is_active ? '' : 'opacity-70'}`}>
    <div className="flex items-start justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
          {team.name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
          <i className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#f1f5f9] ${style.dot} dark:border-[#1f2937]`} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-navy dark:text-white">{team.name}</p>
          <p className="truncate text-[11px] text-slate-500">{team.email ?? 'No login email'}</p>
        </div>
      </div>
      <div className="relative">
        <button type="button" onClick={() => setMenu(!menu)} disabled={busy} aria-label={`Actions for ${team.name}`} aria-expanded={menu} className="rounded-md p-1 text-slate-400 hover:text-navy disabled:opacity-50 dark:hover:text-white"><MoreHorizontal size={17} /></button>
        {menu && <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-8 z-40 w-48 rounded-xl border border-white bg-[#f1f5f9] p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#273449]">
            <MenuItem icon={Pencil} onClick={() => { setMenu(false); onEdit(); }}>Edit / manage members</MenuItem>
            <MenuItem icon={KeyRound} onClick={resetPassword}>Reset password</MenuItem>
            <MenuItem icon={Power} onClick={toggleActive}>{team.is_active ? 'Deactivate' : 'Reactivate'}</MenuItem>
            <MenuItem icon={Trash2} danger onClick={remove}>Delete</MenuItem>
          </div>
        </>}
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] dark:border-slate-700">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
        <MapPin size={13} className="shrink-0" />
        <span className="truncate">{team.current_incident ? team.current_incident.label : 'No active incident'}</span>
      </span>
      <span className={`rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold dark:border-slate-700 ${style.text}`}>{style.label}</span>
    </div>

    <p className="mt-2 text-[11px] text-slate-400" title={team.members.join(', ') || undefined}>{memberLabel}{team.members.length > 0 ? ` - ${team.members.slice(0, 2).join(', ')}${team.members.length > 2 ? '...' : ''}` : ''}</p>
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400">{team.contact_number || 'No contact number'}</span>
      <span className="text-[10px] text-slate-400">{lastSeen(team.last_check_in)}</span>
    </div>
  </div>;
}

function MenuItem({ icon: Icon, children, onClick, danger = false }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-white/80 dark:hover:bg-slate-800 ${danger ? 'text-emergency' : 'text-slate-700 dark:text-slate-200'}`}>
    <Icon size={14} />{children}
  </button>;
}

function TeamPanel({ team, onClose, onDone }: {
  team: FieldTeam | null;
  onClose: () => void;
  onDone: (message: string, credentials?: Credentials) => void;
}) {
  const editing = team !== null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState(team?.contact_number ?? '');
  const [members, setMembers] = useState((team?.members ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    const memberList = Array.from(new Set(members.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
    try {
      if (team) {
        await sendResource(`/api/field-teams/${team.id}`, 'PATCH', { contactNumber: contact.trim() || null, members: memberList });
        onDone(`${team.name} was updated.`);
      } else {
        const result = await sendResource<TeamResult>('/api/field-teams', 'POST', {
          name: name.trim(),
          email: email.trim(),
          contactNumber: contact.trim() || undefined,
          members: memberList,
        });
        if (!result) throw new Error('The server returned no data.');
        onDone(`${result.team.name} was created.`, { name: result.team.name, email: result.team.email ?? email.trim(), password: result.tempPassword ?? '' });
      }
    } catch (cause) {
      setFailure(describeError(cause));
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-white bg-[#f1f5f9] p-6 shadow-2xl dark:border-slate-700 dark:bg-[#1f2937]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <PanelHeader title={editing ? `Edit ${team.name}` : 'Add field team'} detail={editing ? 'Update the contact number and the list of team members.' : 'Type the team name. This creates a shared login for the mobile app, with a temporary password shown once.'} />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-navy" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!editing && <>
          <TextField label="Team name" value={name} onChange={setName} required placeholder="e.g. Team Alpha" />
          <TextField label="Login email" type="email" value={email} onChange={setEmail} required placeholder="alpha@yourdomain.com" />
        </>}
        <div className="sm:col-span-2">
          <TextField label="Contact number" value={contact} onChange={setContact} placeholder="Optional" />
        </div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">Team members (one name per line)
          <textarea value={members} onChange={(event) => setMembers(event.target.value)} rows={4} placeholder={'Juan Dela Cruz\nMaria Santos'} className="inset-control mt-1.5 block w-full px-3 py-2 text-sm dark:text-white" />
        </label>
      </div>
      {failure && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{failure}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Create team'}</Button>
      </div>
    </form>
  </div>;
}

function CredentialsPanel({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${credentials.name}\nEmail: ${credentials.email}\nPassword: ${credentials.password}`);
      setCopied(true);
    } catch { /* clipboard may be blocked; the values are visible to copy by hand */ }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
    <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white bg-[#f1f5f9] p-6 shadow-2xl dark:border-slate-700 dark:bg-[#1f2937]">
      <PanelHeader title={`${credentials.name} login`} detail="Share these with the team now. The password is not stored and cannot be shown again." />
      <dl className="space-y-3 rounded-xl border border-slate-200 bg-white/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</dt><dd className="mt-0.5 break-all font-semibold text-navy dark:text-white">{credentials.email}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Temporary password</dt><dd className="mt-0.5 select-all font-mono text-base font-bold text-navy dark:text-white">{credentials.password}</dd></div>
      </dl>
      {credentials.note && <p className="mt-3 text-xs text-slate-500">{credentials.note}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</Button>
        <Button type="button" size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  </div>;
}

function TextField({ label, value, onChange, required, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}
    <input type={type} required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" />
  </label>;
}