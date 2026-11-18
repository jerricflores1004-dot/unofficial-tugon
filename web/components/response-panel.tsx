'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio, Send, Users } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Button, Toast } from './ui';

type Agency = 'bfp' | 'pnp' | 'coast_guard';
type DispatchStatus = 'dispatched' | 'acknowledged' | 'responding' | 'completed' | 'verified';
type DispatchRow = {
  id: string;
  ticket_id: string;
  agency: Agency;
  status: DispatchStatus;
  note: string | null;
  dispatched_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  return_note: string | null;
  verified_at: string | null;
  observers?: { id: string; team_name: string; status: string }[];
};
type FieldTeamOption = { id: string; name: string; is_active: boolean; current_incident: { id: string } | null };

const AGENCIES: { value: Agency; label: string; short: string }[] = [
  { value: 'bfp', label: 'Bureau of Fire Protection (BFP)', short: 'BFP' },
  { value: 'pnp', label: 'Philippine National Police (PNP)', short: 'PNP' },
  { value: 'coast_guard', label: 'Philippine Coast Guard', short: 'Coast Guard' },
];

const LABEL: Record<DispatchStatus, string> = {
  dispatched: 'Awaiting acknowledgement',
  acknowledged: 'Acknowledged',
  responding: 'Responding',
  completed: 'Awaiting verification',
  verified: 'Verified',
};

const STYLE: Record<DispatchStatus, string> = {
  dispatched: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  acknowledged: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  responding: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

function agencyShort(value: string) {
  return AGENCIES.find((agency) => agency.value === value)?.short ?? value;
}

async function callApi(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'The request failed.');
  return json;
}

export function ResponsePanel({ ticketId, incidentId, closed, onChanged }: {
  ticketId: string | null;
  incidentId?: string | null;
  closed: boolean;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const json = await callApi(`/api/dispatches?ticketId=${ticketId}`, { cache: 'no-store' });
      setRows((json.data ?? []) as DispatchRow[]);
    } catch { /* the next poll will try again */ }
  }, [ticketId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function done(text: string) {
    setToast({ text, tone: 'success' });
    void load();
    onChanged();
  }
  function fail(text: string) {
    setToast({ text, tone: 'error' });
  }

  async function resolveIncident() {
    if (!ticketId) return;
    setResolving(true);
    try {
      await callApi(`/api/tickets/${ticketId}/resolve`, { method: 'POST' });
      done('Incident resolved.');
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'Unable to resolve the incident.');
    } finally {
      setResolving(false);
    }
  }

  const allSent = rows.length >= AGENCIES.length;
  const allVerified = rows.length > 0 && rows.every((row) => row.status === 'verified');

  return <section className="surface p-5">
    <div className="mb-4 flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300"><Radio size={16} /></span>
      <div>
        <h3 className="text-sm font-bold text-navy dark:text-white">Agency response</h3>
        <p className="text-[10px] text-slate-400">Dispatch, verify and resolve from here</p>
      </div>
    </div>

    {!ticketId
      ? <p className="rounded-xl bg-slate-100/70 p-3 text-xs text-slate-500 dark:bg-slate-900/50">This incident has no ticket yet, so it can&apos;t be dispatched.</p>
      : <>
        {rows.length === 0
          ? <p className="rounded-xl bg-slate-100/70 p-3 text-xs text-slate-500 dark:bg-slate-900/50">No agency has been dispatched yet.</p>
          : <ul className="space-y-2">
            {rows.map((row) => <li key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{agencyShort(row.agency)}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STYLE[row.status]}`}>{LABEL[row.status]}</span>
              </div>
              {(row.observers ?? []).length > 0 && <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <Users size={12} className="shrink-0" />
                MDRRMO observer: {(row.observers ?? []).map((observer) => `${observer.team_name} (${observer.status.replace('_', ' ')})`).join(', ')}
              </p>}
              {row.note && <p className="mt-1 text-[11px] text-slate-500">Your message: {row.note}</p>}
              {row.return_note && row.status === 'responding' && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Returned: {row.return_note}</p>}
              {row.status === 'completed' && <ReviewBox row={row} onDone={done} onFailed={fail} />}
            </li>)}
          </ul>}

        {allVerified && !closed && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">All agencies verified. The incident can now be resolved.</p>
          <Button size="sm" className="mt-2 w-full" onClick={resolveIncident} disabled={resolving}>{resolving ? 'Resolving…' : 'Resolve incident'}</Button>
        </div>}

        <Button size="sm" className="mt-3 w-full" onClick={() => setDialogOpen(true)} disabled={closed || allSent}>
          <Send size={14} /> Dispatch to an agency
        </Button>
        {closed && <p className="mt-2 text-[10px] text-slate-400">This incident is closed, so it can&apos;t be dispatched.</p>}
      </>}

    {dialogOpen && ticketId && <DispatchDialog
      ticketId={ticketId}
      incidentId={incidentId ?? null}
      existing={rows}
      onClose={() => setDialogOpen(false)}
      onSent={(label, warning) => {
        setDialogOpen(false);
        if (warning) fail(warning); else done(`Dispatch sent to ${label}.`);
        void load();
        onChanged();
      }}
    />}
    {toast && <Toast tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Toast>}
  </section>;
}

function ReviewBox({ row, onDone, onFailed }: { row: DispatchRow; onDone: (message: string) => void; onFailed: (message: string) => void }) {
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const label = agencyShort(row.agency);

  async function act(action: 'verify' | 'return') {
    setBusy(true);
    try {
      await callApi(`/api/dispatches/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'return' ? { action, note: reason.trim() } : { action }),
      });
      onDone(action === 'verify' ? `${label} report verified.` : `${label} report returned for rework.`);
    } catch (cause) {
      onFailed(cause instanceof Error ? cause.message : 'Unable to update this report.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-100">
    <p className="font-bold">Completion report</p>
    <p className="mt-1 whitespace-pre-wrap">{row.completion_note || 'No report text was attached.'}</p>
    {returning
      ? <div className="mt-3 space-y-2">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={2} placeholder="What does the agency need to redo or clarify?" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setReturning(false); setReason(''); }} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={() => void act('return')} disabled={busy || reason.trim().length < 3}>{busy ? 'Returning…' : 'Return to agency'}</Button>
        </div>
      </div>
      : <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setReturning(true)} disabled={busy}>Return</Button>
        <Button size="sm" onClick={() => void act('verify')} disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</Button>
      </div>}
  </div>;
}

function DispatchDialog({ ticketId, incidentId, existing, onClose, onSent }: {
  ticketId: string;
  incidentId: string | null;
  existing: DispatchRow[];
  onClose: () => void;
  onSent: (agencyLabel: string, warning?: string) => void;
}) {
  const taken = existing.map((item) => item.agency);
  const available = AGENCIES.filter((agency) => !taken.includes(agency.value));
  const [agency, setAgency] = useState<Agency | ''>(available[0]?.value ?? '');
  const [note, setNote] = useState('');
  const [fieldTeamId, setFieldTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const teams = useApi<FieldTeamOption[]>('/api/field-teams');
  const teamOptions = (teams.data ?? []).filter((item) => item.is_active);

  async function send() {
    if (!agency) { setError('Choose an agency.'); return; }
    setBusy(true);
    setError('');
    try {
      const json = await callApi('/api/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, agency, note: note.trim() || undefined, fieldTeamId: fieldTeamId || undefined }),
      });
      onSent(agencyShort(agency), json.observerWarning ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the dispatch.');
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Dispatch to agency">
    <div className="surface w-full max-w-md space-y-4 bg-[#f1f5f9] p-6 dark:bg-[#1f2937]">
      <div>
        <h3 className="text-lg font-bold text-navy dark:text-white">Dispatch to an agency</h3>
        <p className="mt-1 text-xs text-slate-500">The agency account is notified as soon as you send.</p>
      </div>
      {available.length === 0
        ? <p className="text-sm text-slate-600 dark:text-slate-300">All agencies have already been dispatched.</p>
        : <>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Agency
            <select value={agency} onChange={(event) => setAgency(event.target.value as Agency)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              {available.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Message <span className="font-normal text-slate-400">(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Instructions or details for the responders" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Accompanied by <span className="font-normal text-slate-400">(MDRRMO field team, optional)</span>
            <select value={fieldTeamId} onChange={(event) => setFieldTeamId(event.target.value)} disabled={teams.loading} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="">{teams.loading ? 'Loading teams…' : 'No field team'}</option>
              {teamOptions.map((item) => {
                const busyElsewhere = Boolean(item.current_incident && item.current_incident.id !== incidentId);
                return <option key={item.id} value={item.id} disabled={busyElsewhere}>{item.name}{busyElsewhere ? ' (on another incident)' : ''}</option>;
              })}
            </select>
          </label>
          {teams.error && <p className="text-[11px] text-red-600 dark:text-red-300">Field teams could not be loaded: {teams.error}</p>}
        </>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
        {available.length > 0 && <Button size="sm" onClick={send} disabled={busy || !agency}>{busy ? 'Sending…' : 'Send dispatch'}</Button>}
      </div>
    </div>
  </div>;
}