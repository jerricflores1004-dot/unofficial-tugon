'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Filter, Radio, Send, Truck } from 'lucide-react';
import { buildQuery } from '@/lib/api-client';
import { useApi, usePagedApi } from '@/lib/use-api';
import { mapTicket } from '@/lib/mappers';
import type { Pulse, Ticket } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, PriorityBadge, SearchInput, SelectFilter, StatusBadge, Toast } from './ui';

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

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
};

const AGENCIES: { value: Agency; label: string; short: string }[] = [
  { value: 'bfp', label: 'Bureau of Fire Protection (BFP)', short: 'BFP' },
  { value: 'pnp', label: 'Philippine National Police (PNP)', short: 'PNP' },
  { value: 'coast_guard', label: 'Philippine Coast Guard', short: 'Coast Guard' },
];

const DISPATCH_LABEL: Record<DispatchStatus, string> = {
  dispatched: 'Awaiting acknowledgement',
  acknowledged: 'Acknowledged',
  responding: 'Responding',
  completed: 'Awaiting verification',
  verified: 'Verified',
};

const DISPATCH_STYLE: Record<DispatchStatus, string> = {
  dispatched: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  acknowledged: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  responding: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

function agencyShort(value: string) {
  return AGENCIES.find((agency) => agency.value === value)?.short ?? value;
}

async function callApi(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'The request failed.');
  return json;
}

export function TicketsView() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dispatches, setDispatches] = useState<Record<string, DispatchRow[]>>({});
  const [target, setTarget] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const path = buildQuery('/api/tickets', { limit: 100, status: status === 'all' ? null : status });
  const { rows, count, loading, error, reload } = usePagedApi<Record<string, any>>(path, [path]);
  const pulse = useApi<Pulse>('/api/analytics/operations-pulse');
  const tickets = useMemo(() => rows.map(mapTicket), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((ticket) => `${ticket.ticket_number} ${ticket.incident_type} ${ticket.barangay} ${ticket.assigned_to ?? ''}`.toLowerCase().includes(needle));
  }, [tickets, query]);

  const loadDispatches = useCallback(async () => {
    try {
      const res = await fetch('/api/dispatches', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const grouped: Record<string, DispatchRow[]> = {};
      for (const row of (json.data ?? []) as DispatchRow[]) {
        if (!grouped[row.ticket_id]) grouped[row.ticket_id] = [];
        grouped[row.ticket_id].push(row);
      }
      setDispatches(grouped);
    } catch { /* the next poll will try again */ }
  }, []);

  useEffect(() => {
    void loadDispatches();
    const timer = setInterval(() => void loadDispatches(), 15000);
    return () => clearInterval(timer);
  }, [loadDispatches]);

  // Toasts close themselves after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function changed(message: string) {
    setToast(message);
    void loadDispatches();
    reload();
  }

  if (error) return <ErrorState detail={error} onRetry={reload} />;

  return <div className="space-y-5">
    <div className="surface p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex-1"><SearchInput value={query} onChange={setQuery} placeholder="Search ticket ID, incident, barangay, responder…" /></div>
        <SelectFilter label="status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <Button variant="secondary" onClick={() => { reload(); void loadDispatches(); }}>Refresh</Button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <MiniStat icon={Clock3} label="Awaiting assignment" value={pulse.data?.tickets_awaiting_assignment ?? 0} accent="amber" loading={pulse.loading} detail="Open tickets with no responder" />
      <MiniStat icon={Truck} label="In field response" value={pulse.data?.tickets_in_field ?? 0} accent="blue" loading={pulse.loading} detail="Assigned or in progress" />
      <MiniStat icon={CheckCircle2} label="Resolved this week" value={pulse.data?.tickets_resolved_this_week ?? 0} accent="green" loading={pulse.loading} detail={`${pulse.data?.tickets_total ?? 0} tickets in total`} />
    </div>

    <div className="surface overflow-hidden">
      <div className="border-b border-slate-200/70 p-5 dark:border-slate-700">
        <PanelHeader title="Response tickets" detail={loading ? 'Querying the database…' : `${filtered.length} of ${count} tickets · one ticket is created automatically per incident`} action={<span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700"><Filter size={14} /> Database-backed</span>} />
      </div>
      {loading && tickets.length === 0
        ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-16 w-full" />)}</div>
        : filtered.length === 0
          ? <div className="p-6"><EmptyState title="No tickets found" detail="Tickets appear here as soon as incidents are recorded in the database." action={<Button variant="secondary" size="sm" onClick={reload}>Refresh</Button>} /></div>
          : <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} dispatches={dispatches[ticket.id] ?? []} onDispatch={() => setTarget(ticket)} onChanged={changed} onFailed={setToast} />)}
          </div>}
    </div>

    {target && <DispatchDialog
      ticket={target}
      existing={dispatches[target.id] ?? []}
      onClose={() => setTarget(null)}
      onSent={(label) => { setTarget(null); changed(`Dispatch sent to ${label}.`); }}
    />}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function TicketRow({ ticket, dispatches, onDispatch, onChanged, onFailed }: {
  ticket: Ticket;
  dispatches: DispatchRow[];
  onDispatch: () => void;
  onChanged: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const closed = ['rejected', 'closed', 'resolved'].includes(String(ticket.incident_status));
  const allSent = dispatches.length >= AGENCIES.length;
  const awaiting = dispatches.filter((item) => item.status === 'completed');
  const allVerified = dispatches.length > 0 && dispatches.every((item) => item.status === 'verified');

  async function resolveIncident() {
    setResolving(true);
    try {
      await callApi(`/api/tickets/${ticket.id}/resolve`, { method: 'POST' });
      onChanged('Incident resolved.');
    } catch (cause) {
      onFailed(cause instanceof Error ? cause.message : 'Unable to resolve the incident.');
    } finally {
      setResolving(false);
    }
  }

  return <div className="transition-colors hover:bg-white/45">
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ticket.priority === 'critical' ? 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300' : 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300'}`}><Radio size={18} /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-blue">{ticket.ticket_number}</p>
          <p className="truncate text-sm font-bold text-navy dark:text-white">{ticket.incident_type} · {ticket.barangay}</p>
          <p className="mt-1 truncate text-[11px] text-slate-500">Assigned to {ticket.assigned_to || 'the response desk'} · {ticket.updates} update{ticket.updates === 1 ? '' : 's'}</p>
          {dispatches.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
            {dispatches.map((item) => <span key={item.id} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${DISPATCH_STYLE[item.status]}`}>
              {agencyShort(item.agency)} · {DISPATCH_LABEL[item.status]}
            </span>)}
          </div>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Affected</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.affected_people} people</p>
        </div>
        <PriorityBadge priority={ticket.priority} />
        <StatusBadge status={ticket.incident_status} />
        <Link href={`/incidents/${ticket.incident_id}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-blue hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-blue-950/40">Open</Link>
        <Button size="sm" onClick={onDispatch} disabled={allSent || closed}><Send size={14} /> Dispatch</Button>
      </div>
    </div>

    {(awaiting.length > 0 || (allVerified && !closed)) && <div className="space-y-3 px-5 pb-5 md:pl-[76px]">
      {awaiting.map((item) => <ReviewBox key={item.id} item={item} onDone={onChanged} onFailed={onFailed} />)}
      {allVerified && !closed && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">All agencies verified. The incident can be marked as resolved.</p>
        <Button size="sm" onClick={resolveIncident} disabled={resolving}>{resolving ? 'Resolving…' : 'Resolve incident'}</Button>
      </div>}
    </div>}
  </div>;
}

function ReviewBox({ item, onDone, onFailed }: { item: DispatchRow; onDone: (message: string) => void; onFailed: (message: string) => void }) {
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const label = agencyShort(item.agency);

  async function act(action: 'verify' | 'return') {
    setBusy(true);
    try {
      await callApi(`/api/dispatches/${item.id}`, {
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

  return <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-100">
    <p className="font-bold">{label} submitted a completion report</p>
    <p className="mt-1 whitespace-pre-wrap">{item.completion_note || 'No report text was attached.'}</p>
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

function DispatchDialog({ ticket, existing, onClose, onSent }: { ticket: Ticket; existing: DispatchRow[]; onClose: () => void; onSent: (agencyLabel: string) => void }) {
  const taken = existing.map((item) => item.agency);
  const available = AGENCIES.filter((agency) => !taken.includes(agency.value));
  const [agency, setAgency] = useState<Agency | ''>(available[0]?.value ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!agency) { setError('Choose an agency.'); return; }
    setBusy(true);
    setError('');
    try {
      await callApi('/api/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, agency, note: note.trim() || undefined }),
      });
      onSent(agencyShort(agency));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the dispatch.');
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Dispatch to agency">
    <div className="surface w-full max-w-md space-y-4 bg-[#f1f5f9] p-6 dark:bg-[#1f2937]">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-blue">{ticket.ticket_number}</p>
        <h3 className="mt-1 text-lg font-bold text-navy dark:text-white">Dispatch to an agency</h3>
        <p className="mt-1 text-xs text-slate-500">{ticket.incident_type} · {ticket.barangay}. The agency account is notified as soon as you send.</p>
      </div>

      {available.length === 0
        ? <p className="text-sm text-slate-600 dark:text-slate-300">All agencies have already been dispatched to this ticket.</p>
        : <>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Agency
            <select value={agency} onChange={(event) => setAgency(event.target.value as Agency)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              {available.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Message <span className="font-normal text-slate-400">(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Instructions or details for the responders" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          </label>
        </>}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
        {available.length > 0 && <Button size="sm" onClick={send} disabled={busy || !agency}>{busy ? 'Sending…' : 'Send dispatch'}</Button>}
      </div>
    </div>
  </div>;
}