'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Filter, MoreHorizontal, Radio, Truck } from 'lucide-react';
import { buildQuery } from '@/lib/api-client';
import { useApi, usePagedApi } from '@/lib/use-api';
import { mapTicket } from '@/lib/mappers';
import type { Pulse, Ticket } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, PriorityBadge, SearchInput, SelectFilter, StatusBadge } from './ui';

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

export function TicketsView() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const path = buildQuery('/api/tickets', { limit: 100, status: status === 'all' ? null : status });
  const { rows, count, loading, error, reload } = usePagedApi<Record<string, any>>(path, [path]);
  const pulse = useApi<Pulse>('/api/analytics/operations-pulse');
  const tickets = useMemo(() => rows.map(mapTicket), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((ticket) => `${ticket.ticket_number} ${ticket.incident_type} ${ticket.barangay} ${ticket.assigned_to ?? ''}`.toLowerCase().includes(needle));
  }, [tickets, query]);

  if (error) return <ErrorState detail={error} onRetry={reload} />;

  return <div className="space-y-5">
    <div className="surface p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex-1"><SearchInput value={query} onChange={setQuery} placeholder="Search ticket ID, incident, barangay, responder…" /></div>
        <SelectFilter label="status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <Button variant="secondary" onClick={reload}>Refresh</Button>
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
            {filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
          </div>}
    </div>
  </div>;
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  return <div className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/45 md:flex-row md:items-center">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ticket.priority === 'critical' ? 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300' : 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300'}`}><Radio size={18} /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-blue">{ticket.ticket_number}</p>
        <p className="truncate text-sm font-bold text-navy dark:text-white">{ticket.incident_type} · {ticket.barangay}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">Assigned to {ticket.assigned_to || 'the response desk'} · {ticket.updates} update{ticket.updates === 1 ? '' : 's'}</p>
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
      <span className="rounded-lg p-2 text-slate-400" aria-label={`Ticket ${ticket.ticket_number} status`}><MoreHorizontal size={18} /></span>
    </div>
  </div>;
}
