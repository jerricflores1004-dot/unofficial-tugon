'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Loader2, MoreHorizontal, RefreshCw, UserPlus } from 'lucide-react';
import { buildQuery, fetchEnvelope } from '@/lib/api-client';
import { usePagedApi } from '@/lib/use-api';
import { mapIncident } from '@/lib/mappers';
import type { Incident, IncidentStatus, Priority } from '@/lib/types';
import { Button, EmptyState, ErrorState, FilterButton, LoadingSkeleton, PanelHeader, PriorityBadge, SearchInput, SelectFilter, StatusBadge, Toast } from './ui';

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ['pending', 'verified', 'responding', 'resolved', 'closed', 'rejected'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

function csvCell(value: string | number | null) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function IncidentsView() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce free text so each keystroke does not hit the database.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const path = buildQuery('/api/incidents', {
    limit: PAGE_SIZE,
    from: page * PAGE_SIZE,
    status: status === 'all' ? null : status,
    priority: priority === 'all' ? null : priority,
    search: search || null,
  });
  const { rows, count, loading, error, reload } = usePagedApi<Record<string, any>>(path, [path]);
  const incidents = useMemo(() => rows.map(mapIncident), [rows]);
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function resetFilters() { setStatus('all'); setPriority('all'); setQuery(''); setSearch(''); setPage(0); }

  async function exportCsv() {
    setExporting(true);
    try {
      const collected: Incident[] = [];
      for (let offset = 0; offset < Math.max(count, 1); offset += 100) {
        const envelope = await fetchEnvelope<Record<string, any>[]>(buildQuery('/api/incidents', {
          limit: 100,
          from: offset,
          status: status === 'all' ? null : status,
          priority: priority === 'all' ? null : priority,
          search: search || null,
        }));
        collected.push(...(envelope.data ?? []).map(mapIncident));
        if ((envelope.data ?? []).length < 100) break;
      }
      if (collected.length === 0) { setToast('No records matched the current filters.'); return; }
      downloadCsv('tugon-incidents.csv', [
        ['Ticket ID', 'Incident', 'Barangay', 'Location', 'Priority', 'Severity', 'Status', 'Reporter', 'Assigned responder', 'Affected people', 'Reported at'],
        ...collected.map((item) => [item.ticket_id, item.type, item.barangay, item.location, item.priority, item.severity, item.status, item.reporter, item.assigned_to, item.affected_people, item.reported_at]),
      ]);
      setToast(`Exported ${collected.length} incident${collected.length === 1 ? '' : 's'} from the database.`);
    } catch {
      setToast('Export failed. The database did not return the requested rows.');
    } finally {
      setExporting(false);
    }
  }

  if (error && rows.length === 0) return <ErrorState detail={error} onRetry={reload} />;

  return <div className="space-y-5">
    <div className="surface p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1"><SearchInput value={query} onChange={(value) => { setQuery(value); }} placeholder="Search ticket, incident, barangay, reporter…" /></div>
        <div className="flex flex-wrap gap-2">
          <SelectFilter label="status" value={status} onChange={(value) => { setStatus(value); setPage(0); }} options={STATUS_OPTIONS} />
          <SelectFilter label="priority" value={priority} onChange={(value) => { setPriority(value); setPage(0); }} options={PRIORITY_OPTIONS} />
          <FilterButton onClick={resetFilters}>Reset filters</FilterButton>
          <Button variant="secondary" size="sm" onClick={reload}><RefreshCw size={14} /> Refresh</Button>
        </div>
      </div>
    </div>

    <div className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-navy dark:text-white">Incident queue</h3>
          <p className="mt-1 text-xs text-slate-500">{loading ? 'Querying the database…' : `${count} record${count === 1 ? '' : 's'} match the current filters · sorted by most recent`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={exporting || count === 0}>
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={() => setToast('Incidents are created by resident reports submitted to POST /api/incidents. The workspace verifies, assigns, and resolves them.')}>
            <UserPlus size={15} /> How incidents arrive
          </Button>
        </div>
      </div>

      {selected.length > 0 && <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50/70 px-5 py-3 text-xs dark:border-blue-900 dark:bg-blue-950/30">
        <strong className="text-blue-800 dark:text-blue-200">{selected.length} selected</strong>
        <Button variant="ghost" size="sm" onClick={() => setToast('Open an incident to assign a responder from the database roster.')}>Assign</Button>
        <Button variant="ghost" size="sm" onClick={() => setToast('Open an incident to verify it; verification is written to the database.')}>Verify</Button>
        <button onClick={() => setSelected([])} className="ml-auto text-slate-500 hover:text-navy">Clear</button>
      </div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead className="bg-slate-100/70 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-slate-900/40">
            <tr>
              <th className="w-12 px-5 py-3"><input type="checkbox" aria-label="Select all incidents on this page" checked={incidents.length > 0 && incidents.every((item) => selected.includes(item.id))} onChange={(event) => setSelected(event.target.checked ? incidents.map((item) => item.id) : [])} className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue" /></th>
              <th className="px-3 py-3 font-bold">Ticket ID</th>
              <th className="px-3 py-3 font-bold">Incident</th>
              <th className="px-3 py-3 font-bold">Barangay</th>
              <th className="px-3 py-3 font-bold">Priority</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold">Assigned responder</th>
              <th className="px-3 py-3 font-bold">Reported</th>
              <th className="w-20 px-5 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {loading && incidents.length === 0
              ? [0, 1, 2, 3, 4].map((row) => <tr key={row}><td colSpan={9} className="px-5 py-3"><LoadingSkeleton className="h-9 w-full" /></td></tr>)
              : incidents.map((item) => <IncidentTableRow key={item.id} incident={item} checked={selected.includes(item.id)} onCheck={() => toggle(item.id)} />)}
          </tbody>
        </table>
        {!loading && incidents.length === 0 && <div className="p-6">
          <EmptyState title="No incidents found" detail="The database returned no reports for this search and filter combination." action={<Button variant="secondary" size="sm" onClick={resetFilters}>Clear filters</Button>} />
        </div>}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200/70 px-5 py-3 text-xs text-slate-500 dark:border-slate-700">
        <span>{count === 0 ? 'No records' : `Showing ${page * PAGE_SIZE + 1}–${Math.min(count, (page + 1) * PAGE_SIZE)} of ${count}`}</span>
        <div className="flex items-center gap-1">
          <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700">Previous</button>
          <span className="px-2 font-bold text-slate-600 dark:text-slate-300">{page + 1} / {pageCount}</span>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700">Next</button>
        </div>
      </div>
    </div>

    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function IncidentTableRow({ incident, checked, onCheck }: { incident: Incident; checked: boolean; onCheck: () => void }) {
  return <tr className="group transition-colors hover:bg-white/55 dark:hover:bg-slate-800/40">
    <td className="px-5 py-3"><input type="checkbox" aria-label={`Select ${incident.ticket_id}`} checked={checked} onChange={onCheck} className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue" /></td>
    <td className="px-3 py-3"><Link href={`/incidents/${incident.id}`} className="text-xs font-bold text-blue hover:underline">{incident.ticket_id}</Link><p className="mt-1 text-[10px] text-slate-400">{new Date(incident.reported_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p></td>
    <td className="px-3 py-3"><div className="flex items-center gap-2">
      <span className={`h-8 w-1 rounded-full ${incident.priority === 'critical' ? 'bg-critical' : incident.priority === 'high' ? 'bg-high' : incident.priority === 'medium' ? 'bg-medium' : 'bg-low'}`} />
      <div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{incident.type}</p><p className="max-w-[190px] truncate text-[11px] text-slate-500">{incident.location}</p></div>
    </div></td>
    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{incident.barangay}</td>
    <td className="px-3 py-3"><PriorityBadge priority={incident.priority as Priority} /><p className="mt-1 text-[10px] text-slate-400">{incident.ai_triaged_at ? `AI → ${incident.ai_agencies.length > 0 ? incident.ai_agencies.map((agency) => agency === 'coast_guard' ? 'PCG' : agency.toUpperCase()).join(', ') : 'MDRRMO'}` : 'AI triage pending'}</p></td>
    <td className="px-3 py-3"><StatusBadge status={incident.status as IncidentStatus} /></td>
    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{incident.assigned_to || <span className="italic text-slate-400">Unassigned</span>}</td>
    <td className="px-3 py-3 text-xs text-slate-500">{new Date(incident.reported_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</td>
    <td className="px-5 py-3"><div className="flex items-center gap-1">
      <Link href={`/incidents/${incident.id}`} aria-label={`View ${incident.ticket_id}`} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue dark:hover:bg-blue-950/50"><Eye size={16} /></Link>
      <button aria-label={`More actions for ${incident.ticket_id}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal size={16} /></button>
    </div></td>
  </tr>;
}
