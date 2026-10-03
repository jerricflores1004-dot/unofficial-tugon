'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Database, ListTree, Loader2, Radio, Save, Settings as SettingsIcon, Shield, Trash2, X } from 'lucide-react';
import { describeError, request, sendResource } from '@/lib/api-client';
import { useApi, useApiGroup } from '@/lib/use-api';
import { mapIncidentType, settingBool, settingNumber, settingText } from '@/lib/mappers';
import type { IncidentType, Pulse, SystemSetting, WorkspaceSummary } from '@/lib/types';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

type Tab = 'general' | 'reference' | 'integrations';

const TABS: { key: Tab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'reference', label: 'Reference data', icon: ListTree },
  { key: 'integrations', label: 'Integrations', icon: Radio },
];

const TIMEZONES = ['Asia/Manila', 'UTC'];

export function SettingsView() {
  const [tab, setTab] = useState<Tab>('general');
  const settings = useApi<Record<string, any>[]>('/api/settings');
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');

  const map = useMemo(() => (settings.data ?? []).reduce<Record<string, SystemSetting>>((accumulator, row) => {
    accumulator[row.key] = { key: row.key, value: row.value, description: row.description ?? null };
    return accumulator;
  }, {}), [settings.data]);

  if (settings.error) return <ErrorState detail={settings.error} onRetry={settings.reload} />;

  const canWrite = workspace.data?.profile?.role === 'admin';

  return <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
    <div className="surface h-fit p-2">
      {TABS.map((item) => {
        const Icon = item.icon;
        return <button key={item.key} onClick={() => setTab(item.key)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${tab === item.key ? 'bg-blue text-white' : 'text-slate-500 hover:bg-white/60 hover:text-navy dark:hover:bg-slate-800 dark:hover:text-white'}`}><Icon size={15} />{item.label}</button>;
      })}
      <Link href="/admin" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-500 hover:bg-white/60 hover:text-navy dark:hover:bg-slate-800 dark:hover:text-white"><Shield size={15} />Audit &amp; security</Link>
    </div>

    <div className="space-y-5">
      {tab === 'general' && <GeneralTab settings={map} loading={settings.loading} canWrite={canWrite} onSaved={settings.reload} />}
      {tab === 'reference' && <ReferenceTab loading={settings.loading} />}
      {tab === 'integrations' && <IntegrationsTab />}
    </div>
  </div>;
}

function GeneralTab({ settings, loading, canWrite, onSaved }: { settings: Record<string, SystemSetting>; loading: boolean; canWrite: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      organization_name: settingText(settings, 'organization_name'),
      municipality: settingText(settings, 'municipality'),
      default_timezone: settingText(settings, 'default_timezone') || 'Asia/Manila',
      ticket_prefix: settingText(settings, 'ticket_prefix') || 'TGN',
      max_incident_photos: String(settingNumber(settings, 'max_incident_photos', 5)),
      sla_target_minutes: String(settingNumber(settings, 'sla_target_minutes', 60)),
      offline_sync_enabled: String(settingBool(settings, 'offline_sync_enabled', true)),
      map_default_latitude: String(settingNumber(settings, 'map_default_latitude', 0)),
      map_default_longitude: String(settingNumber(settings, 'map_default_longitude', 0)),
      map_default_zoom: String(settingNumber(settings, 'map_default_zoom', 12)),
    });
  }, [settings]);

  async function save() {
    setBusy(true);
    setToast(null);
    try {
      await request('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          organization_name: draft.organization_name,
          municipality: draft.municipality,
          default_timezone: draft.default_timezone,
          ticket_prefix: draft.ticket_prefix,
          max_incident_photos: Number(draft.max_incident_photos) || 5,
          sla_target_minutes: Number(draft.sla_target_minutes) || 60,
          offline_sync_enabled: draft.offline_sync_enabled === 'true',
          map_default_latitude: Number(draft.map_default_latitude) || 0,
          map_default_longitude: Number(draft.map_default_longitude) || 0,
          map_default_zoom: Number(draft.map_default_zoom) || 12,
        }),
      });
      setToast('Settings saved to the database.');
      onSaved();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(false); }
  }

  if (loading) return <div className="surface space-y-3 p-6">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-14 w-full" />)}</div>;

  return <div className="surface p-5 sm:p-6">
    <PanelHeader title="Workspace settings" detail="Every value is stored in public.system_settings and read by the database functions" action={canWrite ? undefined : <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">Read only</span>} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Organization name" value={draft.organization_name} disabled={!canWrite} onChange={(value) => setDraft({ ...draft, organization_name: value })} />
      <Field label="Municipality" value={draft.municipality} disabled={!canWrite} onChange={(value) => setDraft({ ...draft, municipality: value })} />
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Default timezone
        <select value={draft.default_timezone} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, default_timezone: event.target.value })} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
          {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
        <span className="mt-1 block text-[10px] font-normal text-slate-400">Used by the ticket generator and every analytics window.</span>
      </label>
      <Field label="Ticket prefix" value={draft.ticket_prefix} disabled={!canWrite} onChange={(value) => setDraft({ ...draft, ticket_prefix: value })} />
      <Field label="Maximum incident photos" value={draft.max_incident_photos} disabled={!canWrite} type="number" onChange={(value) => setDraft({ ...draft, max_incident_photos: value })} />
      <Field label="SLA target (minutes)" value={draft.sla_target_minutes} disabled={!canWrite} type="number" onChange={(value) => setDraft({ ...draft, sla_target_minutes: value })} />
      <Field label="Map default latitude" value={draft.map_default_latitude} disabled={!canWrite} type="number" onChange={(value) => setDraft({ ...draft, map_default_latitude: value })} />
      <Field label="Map default longitude" value={draft.map_default_longitude} disabled={!canWrite} type="number" onChange={(value) => setDraft({ ...draft, map_default_longitude: value })} />
      <Field label="Map default zoom" value={draft.map_default_zoom} disabled={!canWrite} type="number" onChange={(value) => setDraft({ ...draft, map_default_zoom: value })} />
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Offline report queue
        <select value={draft.offline_sync_enabled} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, offline_sync_enabled: event.target.value })} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
        <span className="mt-1 block text-[10px] font-normal text-slate-400">Read by the resident app before queueing reports.</span>
      </label>
    </div>
    {canWrite && <div className="mt-5 flex justify-end"><Button onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes</Button></div>}
    {!canWrite && <p className="mt-4 text-[11px] text-slate-500">Only administrators can write to system settings. Changes are recorded against the acting user.</p>}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function ReferenceTab({ loading }: { loading: boolean }) {
  const types = useApi<Record<string, any>[]>('/api/incident-types');
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const list = useMemo(() => (types.data ?? []).map(mapIncidentType), [types.data]);
  const canWrite = ['staff', 'admin', 'department_head'].includes(workspace.data?.profile?.role ?? '');

  if (loading || types.loading) return <div className="surface space-y-3 p-6">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-12 w-full" />)}</div>;
  if (types.error) return <ErrorState detail={types.error} onRetry={types.reload} />;

  async function addType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = label.trim();
    if (value.length < 2) { setToast('Enter a label with at least two characters.'); return; }
    setBusy(true);
    try {
      await sendResource('/api/incident-types', 'POST', { label: value });
      setLabel('');
      setToast(`"${value}" is now available in the report form.`);
      types.reload();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(false); }
  }

  async function retire(item: IncidentType) {
    setBusy(true);
    try {
      await sendResource('/api/incident-types', 'DELETE', { id: item.id });
      setToast(`"${item.label}" was retired. Existing incidents keep their label.`);
      types.reload();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div className="surface p-5 sm:p-6">
      <PanelHeader title="Incident type vocabulary" detail="The report form offers exactly these labels — no list is hardcoded in the mobile or web bundle" />
      {list.length === 0
        ? <EmptyState title="No incident types configured" detail="Add a label so residents can classify their reports. The form falls back to free text while this table is empty." />
        : <div className="flex flex-wrap gap-2">
          {list.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {item.label}
            <span className="text-[10px] font-normal text-slate-400">#{item.sort_order}</span>
            {canWrite && <button onClick={() => void retire(item)} disabled={busy} className="text-slate-400 hover:text-emergency disabled:opacity-50" aria-label={`Retire ${item.label}`}><Trash2 size={13} /></button>}
          </span>)}
        </div>}
      {canWrite && <form onSubmit={addType} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Add an incident type…" aria-label="New incident type" className="inset-control h-10 flex-1 px-3 text-sm dark:text-white" />
        <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} className="rotate-45" />} Add type</Button>
      </form>}
    </div>
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function IntegrationsTab() {
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');
  const pulse = useApi<Pulse>('/api/analytics/operations-pulse');
  const integrations = workspace.data?.integrations;

  const rows: { label: string; detail: string; good: boolean }[] = [
    { label: 'Supabase database', detail: integrations?.database ? 'Project URL and anon key are configured' : 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY', good: Boolean(integrations?.database) },
    { label: 'Realtime updates', detail: integrations?.realtime ? 'Incidents, tickets, notifications, announcements' : 'Unavailable without a Supabase project', good: Boolean(integrations?.realtime) },
    { label: 'Photo storage bucket', detail: integrations?.storage ? 'incident-photos is reachable for this session' : 'Create the private incident-photos bucket', good: Boolean(integrations?.storage) },
    { label: 'Push notifications', detail: integrations?.push ? 'FIREBASE_SERVER_KEY is present on the server' : 'Set FIREBASE_SERVER_KEY to deliver alerts', good: Boolean(integrations?.push) },
    { label: 'Map provider', detail: integrations?.maps ? 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured' : 'Set a restricted browser key to plot coordinates', good: Boolean(integrations?.maps) },
  ];

  return <div className="space-y-5">
    <div className="surface p-5 sm:p-6">
      <PanelHeader title="System status" detail="Verified server-side on each request" />
      {workspace.loading
        ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-14 w-full rounded-xl" />)}</div>
        : <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => <div key={row.label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.good ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{row.label}</p><p className="text-[10px] leading-4 text-slate-500">{row.detail}</p></div>
          </div>)}
        </div>}
    </div>
    <div className="surface p-5 sm:p-6">
      <PanelHeader title="Database contents" detail="Live row counts from the operational tables" action={<Database size={16} className="text-slate-400" />} />
      {pulse.loading
        ? <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((row) => <LoadingSkeleton key={row} className="h-12 w-full rounded-xl" />)}</div>
        : <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ['Incidents with coordinates', pulse.data?.incidents_geolocated ?? 0],
            ['Responders', pulse.data?.responders_total ?? 0],
            ['Tickets', pulse.data?.tickets_total ?? 0],
            ['Users', pulse.data?.users_total ?? 0],
            ['Notifications stored', pulse.data?.notifications_unread ?? 0],
            ['Audit log events', pulse.data?.audit_events ?? 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-navy dark:text-white">{value}</dd>
          </div>)}
        </dl>}
      {pulse.error && <p className="mt-3 text-[11px] text-red-600 dark:text-red-300">{pulse.error}</p>}
    </div>
  </div>;
}

function Field({ label, value, onChange, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}
    <input type={type} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm disabled:opacity-60 dark:text-white" />
  </label>;
}
