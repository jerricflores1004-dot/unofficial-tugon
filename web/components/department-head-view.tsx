'use client';

import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock3, FileClock, Loader2, Megaphone, MessageCircle, Plus, Siren, X, type LucideIcon } from 'lucide-react';
import { describeError, sendResource } from '@/lib/api-client';
import { useApiGroup } from '@/lib/use-api';
import { dayLabel, mapAnnouncement, mapFeedback, mapTrend } from '@/lib/mappers';
import type { Announcement, FeedbackItem, Pulse, Summary, TrendPoint } from '@/lib/types';
import { MiniStat } from './mini-stat';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

const PRIORITY_STYLES: Record<Announcement['priority'], { dot: string; label: string }> = {
  urgent: { dot: 'bg-critical', label: 'Urgent' },
  important: { dot: 'bg-medium', label: 'Important' },
  normal: { dot: 'bg-blue', label: 'Normal' },
};

export function DepartmentHeadView() {
  const [toast, setToast] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const data = useApiGroup<{
    summary: Summary;
    pulse: Pulse;
    trend: TrendPoint[];
    announcements: Announcement[];
    feedback: FeedbackItem[];
  }>({
    summary: '/api/analytics/summary?days=30',
    pulse: '/api/analytics/operations-pulse',
    trend: '/api/analytics/incident-trend?days=30',
    announcements: '/api/announcements?scope=all&limit=10',
    feedback: '/api/feedback?limit=6',
  });

  const summary = data.data.summary;
  const pulse = data.data.pulse;
  const trend = useMemo(() => mapTrend(data.data.trend as Record<string, any>[] | null), [data.data.trend]);
  const announcements = useMemo(() => (data.data.announcements as Record<string, any>[] | null ?? []).map(mapAnnouncement), [data.data.announcements]);
  const feedback = useMemo(() => (data.data.feedback as Record<string, any>[] | null ?? []).map(mapFeedback), [data.data.feedback]);
  const peak = trend.reduce((highest, point) => Math.max(highest, point.reports), 0);
  const maxTrend = Math.max(1, peak);
  const failure = data.errors.summary || data.errors.pulse || data.errors.trend;

  if (failure) return <ErrorState detail={failure} onRetry={data.reload} />;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MiniStat icon={BarChart3} label="Incidents this month" value={summary?.incidents_this_month ?? 0} accent="blue" loading={data.loading} detail={`${summary?.total_incidents ?? 0} stored in total`} />
      <MiniStat icon={Clock3} label="Median response time" value={summary ? `${summary.median_response_minutes}m` : '—'} accent="green" loading={data.loading} detail="Report to resolution" />
      <MiniStat icon={CheckCircle2} label="Resolution rate" value={summary ? `${summary.resolution_rate}%` : '—'} accent="green" loading={data.loading} detail={`${pulse?.incidents_unassigned ?? 0} incidents unassigned`} />
      <MiniStat icon={MessageCircle} label="Resident feedback" value={pulse?.feedback_last_30_days ?? 0} accent="amber" loading={data.loading} detail={`Average rating ${pulse?.feedback_average ?? 0} / 5`} />
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
      <div className="surface p-5 sm:p-6">
        <PanelHeader title="Incident trends" detail={data.loading ? 'Loading from the database…' : `Daily reports over the last ${trend.length} days`} />
        <div className="h-[240px] w-full">
          {data.loading && trend.length === 0
            ? <LoadingSkeleton className="h-full w-full rounded-xl" />
            : trend.length === 0
              ? <EmptyState title="No incident history" detail="Daily counts appear once reports are stored." />
              : <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 5" opacity={.45} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" dy={6} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: 'rgba(37,99,235,.06)' }} formatter={(value: number) => [value, 'Reports']} labelStyle={{ fontSize: 11 }} />
                  <Bar dataKey="reports" radius={[4, 4, 0, 0]} maxBarSize={26}>
                    {trend.map((point) => <Cell key={point.day} fill={point.reports === peak && peak > 0 ? '#B91C1C' : '#2563EB'} fillOpacity={point.reports === peak && peak > 0 ? 1 : 0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue" />Reports</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-critical" />Peak day ({peak})</span>
          <span className="ml-auto text-slate-400">Scaled to {maxTrend}</span>
        </div>
      </div>

      <div className="surface p-5 sm:p-6">
        <PanelHeader title="Department priorities" detail="Derived from live database counters" />
        <div className="space-y-3">
          <PriorityAction icon={Siren} title={`${summary?.critical_incidents ?? 0} critical incidents`} detail="Open incidents computed at critical priority" color="red" />
          <PriorityAction icon={Megaphone} title={`${pulse?.announcements_drafts ?? 0} draft announcements`} detail={pulse?.announcements_drafts ? 'Awaiting publication' : 'Nothing waiting for approval'} color="amber" />
          <PriorityAction icon={MessageCircle} title={`${pulse?.feedback_last_30_days ?? 0} resident feedback`} detail={`Average rating ${pulse?.feedback_average ?? 0} / 5`} color="blue" />
          <PriorityAction icon={FileClock} title={`${pulse?.tickets_awaiting_assignment ?? 0} tickets unassigned`} detail="Response workload needing an owner" color="blue" />
        </div>
        <Button variant="secondary" size="sm" className="mt-5 w-full" onClick={data.reload}>Refresh oversight data</Button>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <div className="surface p-5">
        <PanelHeader title="Announcements" detail="Resident-facing communications stored in the database" action={<Button size="sm" onClick={() => setComposing(true)}><Plus size={14} /> New announcement</Button>} />
        {data.loading && announcements.length === 0
          ? <div className="space-y-3">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-9 w-full" />)}</div>
          : announcements.length === 0
            ? <EmptyState title="No announcements" detail="Publish an advisory so residents receive it through the mobile app." />
            : <div className="space-y-3">
              {announcements.map((item) => <AnnouncementRow key={item.id} announcement={item} />)}
            </div>}
      </div>

      <div className="surface p-5">
        <PanelHeader title="Recent feedback" detail="Ratings submitted by residents" />
        {data.loading && feedback.length === 0
          ? <div className="space-y-3">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-12 w-full" />)}</div>
          : feedback.length === 0
            ? <EmptyState title="No feedback yet" detail="Resident ratings appear here as soon as they are stored." />
            : <div className="space-y-3">{feedback.map((item) => <FeedbackRow key={item.id} feedback={item} />)}</div>}
      </div>
    </div>

    {composing && <AnnouncementPanel onClose={() => setComposing(false)} onPublished={(message) => { setComposing(false); setToast(message); data.reload(); }} />}
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </div>;
}

function PriorityAction({ icon: Icon, title, detail, color }: { icon: LucideIcon; title: string; detail: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    blue: 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300',
  };
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colors[color] ?? colors.blue}`}><Icon size={16} /></span>
    <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{title}</p><p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p></div>
  </div>;
}

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const style = PRIORITY_STYLES[announcement.priority];
  return <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <div className="flex items-center gap-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{announcement.title}</p>
      <span className="shrink-0 text-[10px] font-bold text-slate-400">{announcement.is_published ? style.label : 'Draft'}</span>
    </div>
    <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{announcement.body}</p>
    <p className="mt-1 text-[10px] text-slate-400">{announcement.published_at ? `Published ${dayLabel(announcement.published_at)}` : 'Not published'}{announcement.expires_at ? ` · expires ${dayLabel(announcement.expires_at)}` : ''}</p>
  </div>;
}

function FeedbackRow({ feedback }: { feedback: FeedbackItem }) {
  return <div className="flex gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-soft text-[10px] font-bold text-blue dark:bg-blue-950/50 dark:text-blue-300">{feedback.author.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
    <div className="min-w-0 flex-1">
      <div className="flex justify-between gap-2">
        <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{feedback.author}</p>
        <span className="shrink-0 text-[10px] font-bold text-amber-600">★ {feedback.rating.toFixed(1)}</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-500">{feedback.message || 'No written comment was submitted.'}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{dayLabel(feedback.created_at)}</p>
    </div>
  </div>;
}

function AnnouncementPanel({ onClose, onPublished }: { onClose: () => void; onPublished: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Announcement['priority']>('normal');
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await sendResource('/api/announcements', 'POST', { title: title.trim(), body: body.trim(), priority, publish });
      onPublished(publish ? 'Announcement published to residents.' : 'Draft saved.');
    } catch (cause) { setFailure(describeError(cause)); } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-white bg-[#f1f5f9] p-6 shadow-2xl dark:border-slate-700 dark:bg-[#1f2937]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <PanelHeader title="New announcement" detail="Written to public.announcements and delivered through the resident app." />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-navy" aria-label="Close"><X size={18} /></button>
      </div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Title
        <input required minLength={2} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white" />
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">Message
        <textarea required minLength={2} rows={4} value={body} onChange={(event) => setBody(event.target.value)} className="inset-control mt-1.5 block w-full px-3 py-2 text-sm dark:text-white" />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <label className="block flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Announcement['priority'])} className="inset-control mt-1.5 block h-10 w-full px-3 text-sm dark:text-white">
            <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="mt-4 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue" />Publish now</label>
      </div>
      {failure && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{failure}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} {publish ? 'Publish' : 'Save draft'}</Button>
      </div>
    </form>
  </div>;
}
