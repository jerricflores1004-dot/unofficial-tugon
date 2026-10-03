'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertOctagon, ArrowRight, CheckCircle2, Clock3, CloudRain, MapPin, MoreHorizontal, Radio, Siren, Users, Waves } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoIncidents, demoKpis, barangayTrend, incidentTrend, priorityMix } from '@/lib/demo-data';
import type { Incident } from '@/lib/types';
import { isDemoMode } from '@/lib/supabase';
import { MetricCard, PanelHeader, PriorityBadge, StatusBadge } from './ui';

function mapIncident(row: Record<string, any>): Incident {
  const ticket = Array.isArray(row.tickets) ? row.tickets[0] : row.tickets;
  return { id: row.id, ticket_id: ticket?.ticket_number || 'Processing', type: row.incident_type || row.type || 'Incident', location: row.location_text || row.location || 'Location pending', barangay: row.barangay || 'Barangay pending', status: row.status, priority: row.priority, severity: row.severity, reporter: row.users?.full_name || 'Resident', reporter_phone: row.users?.phone || '', assigned_to: row.responders?.name || null, reported_at: row.reported_at, affected_people: row.affected_people || 0, description: row.description || '' };
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-white bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800"><p className="mb-1 font-bold text-slate-700 dark:text-slate-200">{label}</p>{payload.map((item) => <p className="text-slate-500 dark:text-slate-400" key={item.name}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}: <strong className="text-slate-800 dark:text-white">{item.value}</strong></p>)}</div>;
}
function IncidentRow({ incident }: { incident: Incident }) { return <Link href={`/incidents/${incident.id}`} className="group grid grid-cols-[minmax(140px,1.2fr)_minmax(112px,1fr)_90px_92px_36px] items-center gap-3 border-b border-slate-200/75 px-4 py-3 last:border-0 hover:bg-white/50 dark:border-slate-700/70 dark:hover:bg-slate-800/40"><div className="flex min-w-0 items-center gap-3"><span className={`h-8 w-1 shrink-0 rounded-full ${incident.priority === 'critical' ? 'bg-critical' : incident.priority === 'high' ? 'bg-high' : incident.priority === 'medium' ? 'bg-medium' : 'bg-low'}`} /><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{incident.type}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{incident.ticket_id}</p></div></div><div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><MapPin size={13} className="shrink-0 text-slate-400" /><span className="truncate">{incident.barangay}</span></div><PriorityBadge priority={incident.priority} /><StatusBadge status={incident.status} /><MoreHorizontal size={17} className="text-slate-400 group-hover:text-blue" /></Link>; }

export function DashboardView() {
  const [range, setRange] = useState('7d');
  const [rows, setRows] = useState<Incident[]>(demoIncidents);
  const [kpis, setKpis] = useState(demoKpis);
  const [loading, setLoading] = useState(!isDemoMode);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (isDemoMode) return;
    Promise.all([fetch('/api/incidents?limit=5'), fetch('/api/analytics/summary')]).then(async ([incidentsResponse, summaryResponse]) => {
      if (!incidentsResponse.ok || !summaryResponse.ok) throw new Error('workspace unavailable');
      const incidentPayload = await incidentsResponse.json();
      const summaryPayload = await summaryResponse.json();
      const summary = summaryPayload.data || {};
      setRows((incidentPayload.data || []).map(mapIncident));
      setKpis([
        { label: 'Total incidents', value: String(summary.total_incidents ?? 0), change: 'live', trend: 'steady', detail: 'from Supabase' },
        { label: 'Pending verification', value: String(summary.pending_verification ?? 0), change: 'live', trend: 'steady', detail: 'requires review' },
        { label: 'Active responses', value: String(summary.active_responses ?? 0), change: 'live', trend: 'steady', detail: 'in field' },
        { label: 'Resolved today', value: String(summary.resolved_today ?? 0), change: 'live', trend: 'steady', detail: 'today' },
        { label: 'Critical incidents', value: String(summary.critical_incidents ?? 0), change: 'live', trend: 'steady', detail: 'immediate attention' }
      ]);
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);
  const liveCount = rows.filter((incident) => ['pending', 'verified', 'responding'].includes(incident.status)).length;
  const latest = useMemo(() => rows.slice(0, 5), [rows]);
  return <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">{kpis.map((kpi, index) => <MetricCard key={kpi.label} kpi={kpi} icon={[Activity, Clock3, Radio, CheckCircle2, AlertOctagon][index]} critical={index === 4} />)}</div>
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
      <div className="surface p-5 sm:p-6"><PanelHeader title="Incident activity" detail={loadError ? 'Unable to load live data' : loading ? 'Loading live data…' : isDemoMode ? 'Reports received and resolved across Mabini' : 'Reports received from Supabase'} action={<div className="flex rounded-lg bg-slate-200/60 p-1 dark:bg-slate-900/60">{['24h', '7d', '30d'].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${range === item ? 'bg-white text-blue shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}>{item}</button>)}</div>} /><div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={isDemoMode ? incidentTrend : []} margin={{ top: 8, right: 4, left: -25, bottom: 0 }}><defs><linearGradient id="reportsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.24} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 5" opacity={.45} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="reports" name="Received" stroke="#2563EB" strokeWidth={2.5} fill="url(#reportsFill)" /><Area type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div><div className="mt-3 flex items-center gap-5 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue" />Received</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-600" />Resolved</span><span className="ml-auto font-semibold text-slate-400">Live data · Updated just now</span></div></div>
      <div className="surface p-5 sm:p-6"><PanelHeader title="Priority distribution" detail="All active incidents" action={<button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-blue" aria-label="More priority options"><MoreHorizontal size={18} /></button>} /><div className="relative h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={isDemoMode ? priorityMix : []} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={4} strokeWidth={0}>{priorityMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-navy dark:text-white">{isDemoMode ? '248' : (kpis[0]?.value || '0')}</span><span className="text-[10px] text-slate-500">total reports</span></div></div><div className="grid grid-cols-2 gap-x-4 gap-y-2">{(isDemoMode ? priorityMix : []).map((item) => <div key={item.name} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong className="text-slate-700 dark:text-slate-200">{item.value}</strong></div>)}</div></div>
    </section>
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div className="surface overflow-hidden"><div className="p-5 pb-3 sm:p-6 sm:pb-3"><PanelHeader title="Recent incidents" detail={`${liveCount} incidents currently need operational action`} action={<Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-bold text-blue hover:underline">View all <ArrowRight size={14} /></Link>} /></div><div className="hidden grid-cols-[minmax(140px,1.2fr)_minmax(112px,1fr)_90px_92px_36px] gap-3 border-y border-slate-200/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700 sm:grid"><span>Incident</span><span>Barangay</span><span>Priority</span><span>Status</span><span /></div><div className="overflow-x-auto">{latest.map((incident) => <IncidentRow key={incident.id} incident={incident} />)}</div></div>
      <div className="surface p-5 sm:p-6"><PanelHeader title="Operational pulse" detail="Current field readiness" /><div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/25"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"><Radio size={16} /></span><div><p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">All systems operational</p><p className="text-[11px] text-emerald-700 dark:text-emerald-300/80">Realtime connection is stable</p></div></div></div><div className="space-y-3"><div><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">Available responders</span><strong className="text-navy dark:text-white">18 / 24</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full w-3/4 rounded-full bg-emerald-500" /></div></div><div><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">Open tickets SLA</span><strong className="text-navy dark:text-white">92%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full w-[92%] rounded-full bg-blue" /></div></div></div><div className="border-t border-slate-200 pt-4 dark:border-slate-700"><div className="flex items-start gap-3"><CloudRain size={18} className="mt-0.5 text-blue" /><div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Weather advisory</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Moderate to heavy rain expected through 6:00 PM. Review coastal and creek-side reports.</p></div></div></div></div></div>
    </section>
  </div>;
}
