'use client';

import { useMemo, useState } from 'react';
import { Activity, BarChart3, Clock3, Download, FileBarChart2, Loader2, MapPin, UserCheck } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildQuery, describeError, fetchEnvelope } from '@/lib/api-client';
import { useApiGroup } from '@/lib/use-api';
import { mapBarangayStats, mapIncident, mapResponseTimes } from '@/lib/mappers';
import type { BarangayStat, ResponseTimePoint, Summary, TrendPoint } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

type DatasetKey = 'incidents' | 'response' | 'barangay' | 'types';

const REPORT_TYPES: { key: DatasetKey; label: string; detail: string; columns: string[] }[] = [
  { key: 'incidents', label: 'Incident operations summary', detail: 'Every incident row in the selected date range', columns: ['Ticket ID', 'Incident', 'Barangay', 'Location', 'Priority', 'Severity', 'Status', 'Reporter', 'Assigned responder', 'Affected people', 'Latitude', 'Longitude', 'Reported at', 'Resolved at'] },
  { key: 'response', label: 'Response performance', detail: 'Median minutes to resolution per day', columns: ['Day', 'Median minutes', 'Resolved incidents'] },
  { key: 'barangay', label: 'Barangay oversight', detail: 'Incident volume grouped by barangay', columns: ['Barangay', 'Incidents', 'Critical'] },
  { key: 'types', label: 'Incident type profile', detail: 'Incident volume grouped by reported type', columns: ['Incident type', 'Incidents'] },
];

function isoDay(value: string, endOfDay: boolean) {
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [reportType, setReportType] = useState<DatasetKey>('incidents');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const analytics = useApiGroup<{ summary: Summary; barangay: BarangayStat[]; response: ResponseTimePoint[]; types: Record<string, any>[] }>({
    summary: '/api/analytics/summary?days=30',
    barangay: '/api/analytics/incidents-by-barangay?limit=10',
    response: '/api/analytics/response-times?days=30',
    types: '/api/analytics/incidents-by-type?limit=10',
  });

  const barangay = useMemo(() => mapBarangayStats(analytics.data.barangay as Record<string, any>[] | null), [analytics.data.barangay]);
  const response = useMemo(() => mapResponseTimes(analytics.data.response as Record<string, any>[] | null), [analytics.data.response]);
  const summary = analytics.data.summary;
  const maxBarangay = Math.max(1, ...barangay.map((item) => item.value));
  const failure = analytics.errors.summary || analytics.errors.barangay || analytics.errors.response;

  async function generate() {
    setBusy(true);
    setToast(null);
    try {
      const selected = REPORT_TYPES.find((item) => item.key === reportType)!;
      if (reportType === 'incidents') {
        const collected: (string | number | null)[][] = [];
        for (let offset = 0; ; offset += 100) {
          const envelope = await fetchEnvelope<Record<string, any>[]>(buildQuery('/api/incidents', {
            limit: 100, from: offset, since: isoDay(from, false), until: isoDay(to, true),
          }));
          const rows = (envelope.data ?? []).map(mapIncident);
          collected.push(...rows.map((item) => [item.ticket_id, item.type, item.barangay, item.location, item.priority, item.severity, item.status, item.reporter, item.assigned_to, item.affected_people, item.latitude, item.longitude, item.reported_at, item.resolved_at]));
          if (rows.length < 100) break;
        }
        if (collected.length === 0) { setToast('No incidents were recorded in that date range.'); return; }
        downloadCsv(`tugon-incident-summary-${from}-to-${to}.csv`, [selected.columns, ...collected]);
        setToast(`Exported ${collected.length} incident${collected.length === 1 ? '' : 's'} from the database.`);
        return;
      }
      if (reportType === 'response') {
        if (response.length === 0) { setToast('No resolved incidents are stored for that period.'); return; }
        downloadCsv(`tugon-response-performance-${from}-to-${to}.csv`, [selected.columns, ...response.map((item) => [item.day, item.median_minutes, item.resolved])]);
        setToast(`Exported ${response.length} daily response measurements.`);
        return;
      }
      if (reportType === 'barangay') {
        if (barangay.length === 0) { setToast('No incidents are stored yet.'); return; }
        downloadCsv(`tugon-barangay-oversight-${today}.csv`, [selected.columns, ...barangay.map((item) => [item.name, item.value, item.critical])]);
        setToast(`Exported ${barangay.length} barangay rows.`);
        return;
      }
      const types = (analytics.data.types as Record<string, any>[] | null) ?? [];
      if (types.length === 0) { setToast('No incidents are stored yet.'); return; }
      downloadCsv(`tugon-incident-types-${today}.csv`, [selected.columns, ...types.map((item) => [item.incident_type ?? '', item.total ?? 0])]);
      setToast(`Exported ${types.length} incident type rows.`);
    } catch (cause) {
      setToast(describeError(cause));
    } finally { setBusy(false); }
  }

  if (failure) return <ErrorState detail={failure} onRetry={analytics.reload} />;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <MiniStat icon={Activity} label="Reports this month" value={summary?.incidents_this_month ?? 0} accent="blue" loading={analytics.loading} detail={`${summary?.total_incidents ?? 0} incidents stored in total`} />
      <MiniStat icon={Clock3} label="Median response time" value={summary ? `${summary.median_response_minutes}m` : 0} accent="green" loading={analytics.loading} detail="Reported to resolved, all incidents" />
      <MiniStat icon={UserCheck} label="Resolution rate" value={summary ? `${summary.resolution_rate}%` : 0} accent="amber" loading={analytics.loading} detail="Resolved or closed of all reviewed" />
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <div className="surface p-5">
        <PanelHeader title="Barangay oversight" detail={analytics.loading ? 'Loading from the database…' : 'Incident volume by stored barangay'} action={<MapPin size={16} className="text-slate-400" />} />
        {analytics.loading && barangay.length === 0
          ? <div className="space-y-3">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-6 w-full" />)}</div>
          : barangay.length === 0
            ? <EmptyState title="No barangay data" detail="Barangay totals appear once incidents are stored." />
            : barangay.map((item, index) => <div key={item.name} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{item.name}</span>
                <strong className="text-navy dark:text-white">{item.value}{item.critical > 0 ? ` · ${item.critical} critical` : ''}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div style={{ width: `${Math.max(2, (item.value / maxBarangay) * 100)}%` }} className={`h-full rounded-full ${index === 0 ? 'bg-critical' : index === 1 ? 'bg-high' : 'bg-blue'}`} />
              </div>
            </div>)}
      </div>

      <div className="surface p-5">
        <PanelHeader title="Response performance" detail="Median minutes from report to resolution per day" action={<BarChart3 size={16} className="text-slate-400" />} />
        <div className="h-[220px] w-full">
          {analytics.loading && response.length === 0
            ? <LoadingSkeleton className="h-full w-full rounded-xl" />
            : response.length === 0
              ? <EmptyState title="No resolution times yet" detail="Daily medians appear once incidents are resolved and timestamped." />
              : <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...response].reverse()} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 5" opacity={.45} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(value: number) => [`${value} min`, 'Median']} labelStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="median_minutes" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>}
        </div>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.7fr)]">
      <div className="surface p-5">
        <PanelHeader title="Generate a report" detail="Exports are built from the rows the database returns for your role" action={<FileBarChart2 size={16} className="text-slate-400" />} />
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Report type
            <select value={reportType} onChange={(event) => setReportType(event.target.value as DatasetKey)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
              {REPORT_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <span className="mt-1 block text-[10px] font-normal text-slate-400">{REPORT_TYPES.find((item) => item.key === reportType)?.detail}</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">From
              <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-xs dark:text-white" />
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">To
              <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-xs dark:text-white" />
            </label>
          </div>
          <Button className="mt-2 w-full" onClick={generate} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {busy ? 'Querying database…' : 'Generate authorized export'}
          </Button>
          <p className="text-center text-[10px] text-slate-400">Row-level security limits the export to the records your role may read.</p>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-slate-200/70 p-5 dark:border-slate-700">
          <PanelHeader title="Incident type profile" detail="Counts grouped by the stored incident type" />
        </div>
        {analytics.loading
          ? <div className="space-y-2 p-5">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-10 w-full" />)}</div>
          : ((analytics.data.types as Record<string, any>[] | null) ?? []).length === 0
            ? <div className="p-6"><EmptyState title="No incident types recorded" detail="Type counts appear once incidents are stored in the database." /></div>
            : ((analytics.data.types as Record<string, any>[] | null) ?? []).map((item) => <div key={String(item.incident_type)} className="flex items-center gap-3 border-b border-slate-200/70 p-4 last:border-0 dark:border-slate-700">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300"><Activity size={16} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{String(item.incident_type)}</p><p className="mt-1 text-[10px] text-slate-400">Stored incident type</p></div>
              <span className="text-sm font-bold text-navy dark:text-white">{Number(item.total ?? 0)}</span>
            </div>)}
      </div>
    </div>

    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}
