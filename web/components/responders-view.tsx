'use client';

import { useMemo, useState } from 'react';
import { MapPin, MoreHorizontal, Navigation, Plus, Users, Wifi, X } from 'lucide-react';
import { describeError, sendResource } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { mapResponder } from '@/lib/mappers';
import type { Pulse, Responder } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, SelectFilter, Toast } from './ui';

const AVAILABILITY_STYLES: Record<Responder['availability'], { dot: string; text: string }> = {
  available: { dot: 'bg-blue', text: 'text-blue' },
  deployed: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  standby: { dot: 'bg-amber-500', text: 'text-amber-600' },
  offline: { dot: 'bg-slate-400', text: 'text-slate-500' },
};

export function RespondersView() {
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const roster = useApi<Record<string, any>[]>('/api/responders');
  const pulse = useApi<Pulse>('/api/analytics/operations-pulse');
  const responders = useMemo(() => (roster.data ?? []).map(mapResponder), [roster.data]);
  const list = useMemo(() => filter === 'all' ? responders : responders.filter((item) => item.availability === filter), [responders, filter]);

  if (roster.error) return <ErrorState detail={roster.error} onRetry={roster.reload} />;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <MiniStat icon={Users} label="Total responders" value={pulse.data?.responders_total ?? 0} accent="blue" loading={pulse.loading} detail="Records in the responders table" />
      <MiniStat icon={Navigation} label="Currently deployed" value={pulse.data?.responders_deployed ?? 0} accent="green" loading={pulse.loading} detail={`${pulse.data?.responders_standby ?? 0} on standby`} />
      <MiniStat icon={Wifi} label="Checked in (24h)" value={`${pulse.data?.responders_checked_in_24h ?? 0} / ${pulse.data?.responders_total ?? 0}`} accent="amber" loading={pulse.loading} detail="Last check-in recorded in the database" />
    </div>

    <div className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-navy dark:text-white">Response roster</h3>
          <p className="mt-1 text-xs text-slate-500">{roster.loading ? 'Loading roster…' : `${list.length} of ${responders.length} units shown`}</p>
        </div>
        <div className="flex gap-2">
          <SelectFilter label="availability" value={filter} onChange={setFilter} options={['available', 'deployed', 'standby', 'offline']} />
          <Button size="sm" onClick={() => setAdding(true)}><Plus size={15} /> Add responder</Button>
        </div>
      </div>

      {roster.loading && responders.length === 0
        ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((card) => <LoadingSkeleton key={card} className="h-[168px] w-full rounded-xl" />)}</div>
        : list.length === 0
          ? <div className="p-6"><EmptyState title="No responders recorded" detail="Add a response unit so incidents can be assigned from the database roster." action={<Button size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add responder</Button>} /></div>
          : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((item) => <ResponderCard key={item.id} responder={item} onChanged={() => { roster.reload(); pulse.reload(); }} onToast={setToast} />)}
          </div>}
    </div>

    {adding && <AddResponderPanel onClose={() => setAdding(false)} onCreated={(message) => { setAdding(false); setToast(message); roster.reload(); pulse.reload(); }} />}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function ResponderCard({ responder, onChanged, onToast }: { responder: Responder; onChanged: () => void; onToast: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const style = AVAILABILITY_STYLES[responder.availability];

  async function changeAvailability(availability: Responder['availability']) {
    setBusy(true);
    try {
      await sendResource(`/api/responders/${responder.id}`, 'PATCH', { availability });
      onToast(`${responder.name} marked ${availability}.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }
  async function checkIn() {
    setBusy(true);
    try {
      await sendResource(`/api/responders/${responder.id}`, 'PATCH', { checkIn: true });
      onToast(`Check-in recorded for ${responder.name}.`);
      onChanged();
    } catch (cause) { onToast(describeError(cause)); } finally { setBusy(false); }
  }

  return <div className="rounded-xl border border-slate-200 bg-white/35 p-4 dark:border-slate-700 dark:bg-slate-800/30">
    <div className="flex items-start justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
          {responder.name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
          <i className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#f1f5f9] ${style.dot} dark:border-[#1f2937]`} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-navy dark:text-white">{responder.name}</p>
          <p className="truncate text-[11px] text-slate-500">{responder.lead_name || 'No lead recorded'}</p>
        </div>
      </div>
      <span className="text-slate-400" aria-hidden><MoreHorizontal size={17} /></span>
    </div>

    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] dark:border-slate-700">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-500"><MapPin size={13} className="shrink-0" /><span className="truncate">{responder.current_location || 'Location not recorded'}</span></span>
      <select
        value={responder.availability}
        disabled={busy}
        onChange={(event) => void changeAvailability(event.target.value as Responder['availability'])}
        aria-label={`Availability for ${responder.name}`}
        className={`rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-[10px] font-bold capitalize outline-none dark:border-slate-700 ${style.text}`}
      >
        <option value="available">available</option>
        <option value="deployed">deployed</option>
        <option value="standby">standby</option>
        <option value="offline">offline</option>
      </select>
    </div>

    <p className="mt-2 text-[11px] text-slate-400">{responder.unit} · {responder.assigned_incidents} assigned incident{responder.assigned_incidents === 1 ? '' : 's'}</p>
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400">{responder.contact_number || 'No contact number'}</span>
      <button onClick={checkIn} disabled={busy} className="text-[11px] font-bold text-blue hover:underline disabled:opacity-50">Check in now</button>
    </div>
  </div>;
}

function AddResponderPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const [name, setName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [unit, setUnit] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await sendResource('/api/responders', 'POST', {
        name: name.trim(),
        leadName: leadName.trim() || undefined,
        unit: unit.trim(),
        contactNumber: contactNumber.trim() || undefined,
        currentLocation: currentLocation.trim() || undefined,
      });
      onCreated(`${name.trim()} was added to the responder roster.`);
    } catch (cause) {
      setFailure(describeError(cause));
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-white bg-[#f1f5f9] p-6 shadow-2xl dark:border-slate-700 dark:bg-[#1f2937]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <PanelHeader title="Add responder" detail="Stored in the responders table and available for incident assignment." />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-navy" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Unit name" value={name} onChange={setName} required placeholder="Team Alpha" />
        <Field label="Lead" value={leadName} onChange={setLeadName} placeholder="Optional" />
        <Field label="Function" value={unit} onChange={setUnit} required placeholder="Rescue & water" />
        <Field label="Contact number" value={contactNumber} onChange={setContactNumber} placeholder="Optional" />
        <div className="sm:col-span-2"><Field label="Current location" value={currentLocation} onChange={setCurrentLocation} placeholder="MDRRMO HQ" /></div>
      </div>
      {failure && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{failure}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save responder'}</Button>
      </div>
    </form>
  </div>;
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}
    <input required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" />
  </label>;
}
