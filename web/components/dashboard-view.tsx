'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity, AlertOctagon, ArrowRight, CheckCircle2, Clock3, Megaphone, MoreHorizontal, Radio, Siren, Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiGroup, usePagedApi } from '@/lib/use-api';
import { buildQuery } from '@/lib/api-client';
import { dayLabel, mapAnnouncement, mapIncident, mapPriorityMix, mapTrend } from '@/lib/mappers';
import type { Announcement, Incident, Kpi, PrioritySlice, Pulse, Summary, TrendPoint } from '@/lib/types';
import { Button, EmptyState, ErrorState, LoadingSkeleton, MetricCard, PanelHeader, PriorityBadge, StatusBadge } from './ui';

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-white bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
    <p className="mb-1 font-bold text-slate-700 dark:text-slate-200">{label}</p>
    {payload.map((item) => <p className="text-slate-500 dark:text-slate-400" key={item.name}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}: <strong className="text-slate-800 dark:text-white">{item.value}</strong></p>)}
  </div>;
}

function IncidentRow({ incident }: { incident: Incident }) {
  return <Link href={`/incidents/${incident.id}`} className="group grid grid-cols-[minmax(140px,1.2fr)_minmax(112px,1fr)_90px_92px_36px] items-center gap-3 border-b border-slate-200/75 px-4 py-3 last:border-0 hover:bg-white/50 dark:border-slate-700/70 dark:hover:bg-slate-800/40">
    <div className="flex min-w-0 items-center gap-3">
      <span className={`h-8 w-1 shrink-0 rounded-full ${incident.priority === 'critical' ? 'bg-critical' : incident.priority === 'high' ? 'bg-high' : incident.priority === 'medium' ? 'bg-medium' : 'bg-low'}`} />
      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{incident.type}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{incident.ticket_id}</p></div>
    </div>
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><span className="truncate">{incident.barangay}</span></div>
    <PriorityBadge priority={incident.priority} />
    <StatusBadge status={incident.status} />
    <MoreHorizontal size={17} className="text-slate-400 group-hover:text-blue" />
  </Link>;
}

/** Period-over-period change computed from two database counts. */
function changeFrom(current: number, previous: number): { change: string; trend: Kpi['trend'] } {
  if (previous === 0) return { change: current === 0 ? 'no change' : `${current} new`, trend: current === 0 ? 'steady' : 'up' };
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  if (rounded === 0) return { change: 'no change', trend: 'steady' };
  return { change: `${delta > 0 ? '+' : '−'}${rounded}%`, trend: delta > 0 ? 'up' : 'down' };
}

export function DashboardView() {
  const [rangeIndex, setRangeIndex] = useState(0);
  const days = RANGES[rangeIndex].days;

  const analytics = useApiGroup<{ summary: Summary; trend: TrendPoint[]; mix: PrioritySlice[]; pulse: Pulse; announcements: Announcement[] }>({
    summary: buildQuery('/api/analytics/summary', { days }),
    trend: buildQuery('/api/analytics/incident-trend', { days }),
    mix: '/api/analytics/priority-mix',
    pulse: '/api/analytics/operations-pulse',
    announcements: buildQuery('/api/announcements', { limit: 2 }),
  });
  const incidents = usePagedApi<Record<string, any>>(buildQuery('/api/incidents', { limit: 5 }));

  const summary = analytics.data.summary;
  const pulse = analytics.data.pulse;
  const trend = useMemo(() => mapTrend(analytics.data.trend as Record<string, any>[] | null), [analytics.data.trend]);
  const mix = useMemo(() => mapPriorityMix(analytics.data.mix as Record<string, any>[] | null), [analytics.data.mix]);
  const announcements = useMemo(
    () => (analytics.data.announcements as Record<string, any>[] | null ?? []).map(mapAnnouncement),
    [analytics.data.announcements]
  );
  const rows = useMemo(() => incidents.rows.map(mapIncident), [incidents.rows]);
  const openPriorityTotal = mix.reduce((total, slice) => total + slice.value, 0);
  const loading = analytics.loading || incidents.loading;
  const failure = analytics.errors.summary || analytics.errors.trend || analytics.errors.mix || incidents.error;

  const kpis: Kpi[] = [
    {
      label: 'Total incidents',
      value: String(summary?.total_incidents ?? 0),
      ...changeFrom(summary?.period_reports ?? 0, summary?.period_reports_previous ?? 0),
      detail: `${summary?.period_reports ?? 0} reported in the last ${summary?.period_days ?? days} days`,
    },
    { label: 'Pending verification', value: String(summary?.pending_verification ?? 0), change: 'live', trend: 'steady', detail: 'Awaiting staff review' },
    { label: 'Active responses', value: String(summary?.active_responses ?? 0), change: 'live', trend: 'steady', detail: 'Teams currently in the field' },
    { label: 'Resolved today', value: String(summary?.resolved_today ?? 0), change: 'live', trend: 'steady', detail: `${summary?.period_resolved ?? 0} resolved in ${summary?.period_days ?? days} days` },
    { label: 'Critical incidents', value: String(summary?.critical_incidents ?? 0), change: 'live', trend: 'steady', detail: 'Open and needing immediate attention' },
  ];

  const responderTotal = pulse?.responders_total ?? 0;
  const responderAvailable = pulse?.responders_available ?? 0;
  const responderShare = responderTotal > 0 ? Math.round((responderAvailable / responderTotal) * 100) : 0;
  const slaMeasured = pulse?.tickets_sla_measured ?? 0;
  const slaShare = slaMeasured > 0 ? Math.round(((pulse?.tickets_sla_met ?? 0) / slaMeasured) * 100) : 0;
  const liveCount = rows.filter((incident) => ['pending', 'verified', 'responding'].includes(incident.status)).length;

  if (failure) return <ErrorState detail={failure} onRetry={() => { analytics.reload(); incidents.reload(); }} />;

  return <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi, index) => loading
        ? <LoadingSkeleton key={kpi.label} className="h-[132px] w-full rounded-2xl" />
        : <MetricCard key={kpi.label} kpi={kpi} icon={[Activity, Clock3, Radio, CheckCircle2, AlertOctagon][index]} critical={index === 4} />)}
    </div>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
      <div className="surface p-5 sm:p-6">
        <PanelHeader
          title="Incident activity"
          detail={loading ? 'Loading from the database…' : `Reports received and resolved over the last ${days} days`}
          action={<div className="flex rounded-lg bg-slate-200/60 p-1 dark:bg-slate-900/60">
            {RANGES.map((item, index) => <button key={item.label} onClick={() => setRangeIndex(index)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${rangeIndex === index ? 'bg-white text-blue shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}>{item.label}</button>)}
          </div>}
        />
        <div className="h-[230px] w-full">
          {loading ? <LoadingSkeleton className="h-full w-full rounded-xl" /> : trend.length === 0
            ? <EmptyState title="No incident history yet" detail="Daily counts appear here as soon as reports are stored in the database." />
            : <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 4, left: -25, bottom: 0 }}>
                <defs><linearGradient id="reportsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.24} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 5" opacity={.45} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="reports" name="Received" stroke="#2563EB" strokeWidth={2.5} fill="url(#reportsFill)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>}
        </div>
        <div className="mt-3 flex items-center gap-5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue" />Received</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-600" />Resolved</span>
          <span className="ml-auto font-semibold text-slate-400">{trend.length > 0 ? `Through ${trend[trend.length - 1].label || dayLabel(new Date().toISOString())}` : 'No data'}</span>
        </div>
      </div>

      <div className="surface p-5 sm:p-6">
        <PanelHeader title="Priority distribution" detail="Incidents still needing attention, by computed priority" />
        <div className="relative h-[190px]">
          {loading ? <LoadingSkeleton className="h-full w-full rounded-xl" /> : openPriorityTotal === 0
            ? <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">No active incidents recorded.</div>
            : <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix.filter((slice) => slice.value > 0)} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={4} strokeWidth={0}>
                    {mix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-navy dark:text-white">{openPriorityTotal}</span>
                <span className="text-[10px] text-slate-500">active incidents</span>
              </div>
            </>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {mix.map((item) => <div key={item.name} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
            <strong className="text-slate-700 dark:text-slate-200">{loading ? '—' : item.value}</strong>
          </div>)}
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div className="surface overflow-hidden">
        <div className="p-5 pb-3 sm:p-6 sm:pb-3">
          <PanelHeader title="Recent incidents" detail={`${liveCount} of the ${rows.length} latest records need operational action`} action={<Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-bold text-blue hover:underline">View all <ArrowRight size={14} /></Link>} />
        </div>
        {loading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((row) => <LoadingSkeleton key={row} className="h-12 w-full" />)}</div>
          : rows.length === 0 ? <div className="p-6"><EmptyState title="No incidents in the database" detail="Reports submitted through the resident app appear here immediately." action={<Button onClick={() => incidents.reload()} variant="secondary" size="sm">Refresh</Button>} /></div>
            : <>
              <div className="hidden grid-cols-[minmax(140px,1.2fr)_minmax(112px,1fr)_90px_92px_36px] gap-3 border-y border-slate-200/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700 sm:grid"><span>Incident</span><span>Barangay</span><span>Priority</span><span>Status</span><span /></div>
              <div className="overflow-x-auto">{rows.map((incident) => <IncidentRow key={incident.id} incident={incident} />)}</div>
            </>}
      </div>

      <div className="surface p-5 sm:p-6">
        <PanelHeader title="Operational pulse" detail="Readiness counted from the database" />
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">Available responders</span><strong className="text-navy dark:text-white">{loading ? '—' : `${responderAvailable} / ${responderTotal}`}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${responderShare}%` }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">Ticket SLA met</span><strong className="text-navy dark:text-white">{loading ? '—' : slaMeasured > 0 ? `${slaShare}%` : 'No data'}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue transition-[width] duration-300" style={{ width: `${slaShare}%` }} /></div>
              <p className="mt-1 text-[10px] text-slate-400">{slaMeasured > 0 ? `${pulse?.tickets_sla_met ?? 0} of ${slaMeasured} resolved tickets` : 'Resolved tickets with a recorded resolution time'}</p>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">Deployed units</span><strong className="text-navy dark:text-white">{loading ? '—' : `${pulse?.responders_deployed ?? 0}`}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-amber-500 transition-[width] duration-300" style={{ width: `${responderTotal > 0 ? Math.round(((pulse?.responders_deployed ?? 0) / responderTotal) * 100) : 0}%` }} /></div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <Megaphone size={18} className="mt-0.5 shrink-0 text-blue" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Latest announcement</p>
                {announcements.length === 0
                  ? <p className="mt-1 text-[11px] leading-4 text-slate-500">No published announcement is stored in the database.</p>
                  : <div className="mt-1"><p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{announcements[0].title}</p><p className="mt-0.5 line-clamp-3 text-[11px] leading-4 text-slate-500">{announcements[0].body}</p><p className="mt-1 text-[10px] text-slate-400">{announcements[0].published_at ? dayLabel(announcements[0].published_at) : 'Draft'}</p></div>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-[11px] text-slate-500 dark:border-slate-700">
            <Users size={15} className="text-blue" />
            <span>{loading ? 'Loading unassigned workload…' : `${pulse?.incidents_unassigned ?? 0} open incidents have no responder assigned`}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-[11px] text-slate-500 dark:border-slate-700">
            <Siren size={15} className="text-critical" />
            <span>{loading ? 'Loading ticket queue…' : `${pulse?.tickets_awaiting_assignment ?? 0} tickets await assignment · ${pulse?.tickets_in_field ?? 0} in the field`}</span>
          </div>
        </div>
      </div>
    </section>
  </div>;
}