'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Filter, Radio, Truck } from 'lucide-react';
import { buildQuery } from '@/lib/api-client';
import { useApi, usePagedApi } from '@/lib/use-api';
import { mapTicket } from '@/lib/mappers';
import type { Pulse, Ticket } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, PriorityBadge, SearchInput, SelectFilter, StatusBadge } from './ui';

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

type DispatchStatus = 'dispatched' | 'acknowledged' | 'responding' | 'completed' | 'verified';
type DispatchRow = { id: string; ticket_id: string; agency: string; status: DispatchStatus };

const AGENCY_SHORT: Record<string, string> = { bfp: 'BFP', pnp: 'PNP', coast_guard: 'Coast Guard' };

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

export function TicketsView() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dispatches, setDispatches] = useState<Record<string, DispatchRow[]>>({});
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
        <PanelHeader title="Response tickets" detail={loading ? 'Querying the database…' : `${filtered.length} of ${count} tickets · dispatch and verify from the incident page`} action={<span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700"><Filter size={14} /> Read-only overview</span>} />
      </div>
      {loading && tickets.length === 0
        ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-16 w-full" />)}</div>
        : filtered.length === 0
          ? <div className="p-6"><EmptyState title="No tickets found" detail="Tickets appear here as soon as incidents are recorded in the database." action={<Button variant="secondary" size="sm" onClick={reload}>Refresh</Button>} /></div>
          : <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} dispatches={dispatches[ticket.id] ?? []} />)}
          </div>}
    </div>
  </div>;
}

function TicketRow({ ticket, dispatches }: { ticket: Ticket; dispatches: DispatchRow[] }) {
  const needsVerification = dispatches.some((item) => item.status === 'completed');
  const readyToResolve = dispatches.length > 0 && dispatches.every((item) => item.status === 'verified')
    && !['rejected', 'closed', 'resolved'].includes(String(ticket.incident_status));
  const linkLabel = needsVerification ? 'Review report' : readyToResolve ? 'Resolve' : 'Open';
  const highlighted = needsVerification || readyToResolve;

  return <div className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/45 md:flex-row md:items-center">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ticket.priority === 'critical' ? 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300' : 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300'}`}><Radio size={18} /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-blue">{ticket.ticket_number}</p>
        <p className="truncate text-sm font-bold text-navy dark:text-white">{ticket.incident_type} · {ticket.barangay}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">Assigned to {ticket.assigned_to || 'the response desk'} · {ticket.updates} update{ticket.updates === 1 ? '' : 's'}</p>
        {dispatches.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
          {dispatches.map((item) => <span key={item.id} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${DISPATCH_STYLE[item.status]}`}>
            {AGENCY_SHORT[item.agency] ?? item.agency} · {DISPATCH_LABEL[item.status]}
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
      <Link href={`/incidents/${ticket.incident_id}`} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${highlighted ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300' : 'border-slate-200 text-blue hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-blue-950/40'}`}>{linkLabel}</Link>
    </div>
  </div>;
}