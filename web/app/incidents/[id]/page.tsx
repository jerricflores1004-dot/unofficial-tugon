'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock3, Image as ImageIcon, Loader2, MapPin, MessageSquare, Phone,
  Send, Shield, UserRound, Users, XCircle, type LucideIcon,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PriorityBadge, StatusBadge, Toast } from '@/components/ui';
import { describeError, sendResource } from '@/lib/api-client';
import { useApi, useApiGroup } from '@/lib/use-api';
import { dayLabel, mapIncident, mapIncidentPhoto, mapIncidentUpdate, mapResponder, roleLabel } from '@/lib/mappers';
import { relativeTime } from '@/lib/format';
import { METRICS, SEVERITY_RULE } from '@/lib/severity-matrix';
import type { Incident, IncidentPhoto, IncidentUpdate, IncidentStatus, Responder, WorkspaceSummary } from '@/lib/types';
import { ResponsePanel } from '@/components/response-panel';

type IncidentDetailRow = Record<string, any>;

const WORKFLOW: { status: IncidentStatus; label: string; hint: string }[] = [
  { status: 'pending', label: 'Report received', hint: 'Stored by the resident submission' },
  { status: 'verified', label: 'Incident verified', hint: 'Confirmed by authorized staff' },
  { status: 'responding', label: 'Response team dispatched', hint: 'A responder owns the ticket' },
  { status: 'resolved', label: 'Resolution recorded', hint: 'Field work completed' },
  { status: 'closed', label: 'Incident closed', hint: 'No further action required' },
];

const AGENCY_LABELS: Record<string, string> = { bfp: 'BFP', pnp: 'PNP', coast_guard: 'Coast Guard' };

const STATUS_ORDER: IncidentStatus[] =['pending', 'verified', 'responding', 'resolved', 'closed'];

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  const detail = useApi<IncidentDetailRow>(`/api/incidents/${params.id}`, [params.id]);
  const photos = useApi<Record<string, any>[]>(`/api/incidents/${params.id}/photos`, [params.id]);
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');
  const roster = useApi<Record<string, any>[]>('/api/responders');

  const incident = useMemo(() => (detail.data ? mapIncident(detail.data) : null), [detail.data]);
  const updates = useMemo<IncidentUpdate[]>(() => {
    const ticket = detail.data?.ticket;
    const rows = Array.isArray(ticket) ? ticket[0]?.updates : ticket?.updates;
    return (rows ?? []).map(mapIncidentUpdate);
  }, [detail.data]);
  const attachments = useMemo<IncidentPhoto[]>(
    () => (photos.data ?? []).map((row) => mapIncidentPhoto(row, row.signed_url ?? null)),
    [photos.data]
  );
  const responders = useMemo(() => (roster.data ?? []).map(mapResponder), [roster.data]);
  const reporter = detail.data?.reporter;
  const verifier = detail.data?.verifier;
  const ticketRow = Array.isArray(detail.data?.ticket) ? detail.data?.ticket[0] : detail.data?.ticket;
  const canManage = workspace.data?.profile?.role === 'admin';

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [assignment, setAssignment] = useState<string>('');

  useEffect(() => {
    if (incident?.assigned_responder_id) setAssignment(incident.assigned_responder_id);
  }, [incident?.assigned_responder_id]);

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(message);
    try {
      await sendResource(`/api/incidents/${params.id}`, 'PATCH', body);
      setToast(message);
      detail.reload();
      workspace.reload();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(null); }
  }

  async function runTriage() {
    setBusy('triage');
    try {
      await sendResource(`/api/incidents/${params.id}/triage`, 'POST', {});
      setToast('AI triage finished.');
      detail.reload();
      workspace.reload();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(null); }
  }

  if (detail.error) {
    return <AppShell title="Incident detail" eyebrow="Operations / Incidents / Detail">
      <ErrorState title="Incident unavailable" detail={detail.error} onRetry={detail.reload} />
    </AppShell>;
  }

  if (detail.loading || !incident) {
    return <AppShell title="Incident detail" eyebrow="Operations / Incidents / Detail">
      <div className="space-y-5"><LoadingSkeleton className="h-52 w-full rounded-2xl" /><LoadingSkeleton className="h-72 w-full rounded-2xl" /></div>
    </AppShell>;
  }

  const currentIndex = STATUS_ORDER.indexOf(incident.status);
  const rejected = incident.status === 'rejected';

  return <AppShell
    title="Incident detail"
    eyebrow="Operations / Incidents / Detail"
    action={<Link href="/incidents" className="inline-flex items-center gap-2 text-xs font-bold text-blue hover:underline"><ArrowLeft size={15} /> Back to incidents</Link>}
  >
    <div className="space-y-5">
      <div className={`surface border-l-4 p-5 sm:p-6 ${incident.priority === 'critical' ? 'border-l-critical' : incident.priority === 'high' ? 'border-l-high' : incident.priority === 'medium' ? 'border-l-medium' : 'border-l-blue'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-blue">{incident.ticket_id}</span>
              <StatusBadge status={incident.status} />
              <PriorityBadge priority={incident.priority} />
            </div>
            <h3 className="mt-3 text-2xl font-bold text-navy dark:text-white">{incident.type}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />{incident.location} · {incident.barangay}</p>
            {incident.latitude !== null && incident.longitude !== null && <p className="mt-1 text-[11px] text-slate-400">Stored coordinates: {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</p>}
          </div>
          {canManage && <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" disabled={busy !== null || !['pending', 'verified'].includes(incident.status)} onClick={() => void patch({ status: 'rejected' }, 'Incident rejected.')}>
                        {busy === 'Incident rejected.' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                      </Button>
                      {incident.status === 'pending' && <Button size="sm" disabled={busy !== null} onClick={() => void patch({ status: 'verified' }, 'Incident verified.')}>
                        {busy === 'Incident verified.' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Verify incident
                      </Button>}
                      {incident.status === 'resolved' && <Button size="sm" disabled={busy !== null} onClick={() => void patch({ status: 'closed' }, 'Incident closed.')}>
                        {busy === 'Incident closed.' ? <Loader2 size={14} className="animate-spin" /> : <Shield size={15} />} Close
                      </Button>}
                    </div>}
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-200/70 pt-5 sm:grid-cols-4 dark:border-slate-700">
          <Detail label="Reported" value={`${dayLabel(incident.reported_at)} · ${new Date(incident.reported_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`} />
          <Detail label="Affected people" value={`${incident.affected_people} reported`} />
          <Detail label="Priority reason" value={incident.severity === 'critical' ? 'Critical severity' : incident.severity === 'high' && incident.vulnerable_groups.length > 0 ? 'High severity with a vulnerable group' : `Severity set to ${incident.severity}`} />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-blue/20 bg-blue/5 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <p className="font-bold uppercase tracking-wider text-blue">{incident.ai_source === 'rules' ? 'Triage (keyword rules, AI unavailable)' : 'AI triage'}</p>
            {incident.ai_triaged_at
              ? <>
                <p className="mt-1"><strong>{incident.severity.toUpperCase()}</strong> · Auto-dispatched to {incident.ai_agencies.length > 0 ? incident.ai_agencies.map((agency) => AGENCY_LABELS[agency] ?? agency).join(', ') : 'no agency (MDRRMO handles it)'}</p>
                {incident.ai_reason && <p className="mt-1">{incident.ai_reason}</p>}
                {incident.ai_metrics && <SeverityMetrics metrics={incident.ai_metrics} />}
                <p className="mt-1 text-[11px] text-slate-400">{relativeTime(incident.ai_triaged_at)}</p>
              </>
              : <p className="mt-1">Not triaged yet. The report was not auto-dispatched.</p>}
          </div>
          {canManage && !incident.ai_triaged_at && <Button size="sm" disabled={busy !== null} onClick={() => void runTriage()}>
            {busy === 'triage' ? <Loader2 size={14} className="animate-spin" /> : <Shield size={15} />} Run AI triage
          </Button>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <div className="space-y-5">
          <section className="surface p-5 sm:p-6">
            <SectionHeading icon={Shield} title="Incident information" />
            <p className="whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{incident.description || 'No description was submitted with this report.'}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoBlock label="Incident type" value={incident.type} />
              <InfoBlock label="Severity" value={incident.severity.toUpperCase()} />
              <InfoBlock label="Barangay" value={incident.barangay} />
              <InfoBlock label="Exact location" value={incident.location} />
              <InfoBlock label="Vulnerable groups" value={incident.vulnerable_groups.length > 0 ? incident.vulnerable_groups.join(', ') : 'None declared'} />
              <InfoBlock label="Ticket status" value={ticketRow ? String(ticketRow.status).replace('_', ' ') : 'No ticket row'} />
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <SectionHeading icon={Clock3} title="Status timeline" />
            {rejected
              ? <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">This incident was rejected and is excluded from the operational workflow.</div>
              : <div className="space-y-0">
                {WORKFLOW.map((step, index) => {
                  const done = currentIndex >= index;
                  const timestamp = step.status === 'pending' ? incident.reported_at
                    : step.status === 'verified' ? incident.verified_at
                      : step.status === 'resolved' ? incident.resolved_at
                        : null;
                  return <div className="flex gap-3" key={step.status}>
                    <div className="flex flex-col items-center">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? 'bg-blue text-white' : 'border-2 border-slate-200 text-slate-300 dark:border-slate-700'}`}>
                        {done ? <CheckCircle2 size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      {index < WORKFLOW.length - 1 && <span className={`h-12 w-px ${done ? 'bg-blue/40' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-bold ${done ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{timestamp ? `${dayLabel(timestamp)} · ${relativeTime(timestamp)}` : done ? step.hint : 'Awaiting action'}</p>
                    </div>
                  </div>;
                })}
              </div>}
          </section>

          <section className="surface p-5 sm:p-6">
            <SectionHeading icon={MessageSquare} title="Communication log" detail={`${updates.length} stored update${updates.length === 1 ? '' : 's'}`} />
            {updates.length === 0
              ? <div className="rounded-xl bg-slate-100/70 p-3 text-xs text-slate-500 dark:bg-slate-900/50">No internal updates have been recorded for this incident.</div>
              : <ul className="space-y-3">
                {updates.map((update) => <li key={update.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{update.author}</p><span className="shrink-0 text-[10px] text-slate-400">{relativeTime(update.created_at)}</span></div>
                  <p className="mt-1 whitespace-pre-line text-[11px] leading-4 text-slate-500">{update.message}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">{update.update_type.replace(/_/g, ' ')}</p>
                </li>)}
              </ul>}
            {canManage && <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => { event.preventDefault(); const message = note.trim(); if (!message) return; setNote(''); void patch({ internalNote: message }, 'Internal update saved.'); }}
            >
              <input value={note} onChange={(event) => setNote(event.target.value)} className="inset-control h-10 flex-1 px-3 text-xs dark:text-white" placeholder="Add an internal update…" aria-label="Add internal update" maxLength={2000} />
              <Button type="submit" size="sm" aria-label="Send update" disabled={busy !== null || note.trim().length === 0}>{busy !== null ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</Button>
            </form>}
          </section>
        </div>

        {canManage && <ResponsePanel
                            ticketId={ticketRow?.id ?? null}
                            incidentId={incident.id}
                    closed={['rejected', 'resolved', 'closed'].includes(incident.status)}
                    onChanged={() => { detail.reload(); workspace.reload(); }}
                  />}

        <aside className="space-y-5">
          <section className="surface p-5">
            <SectionHeading icon={UserRound} title="Reporter information" />
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-soft text-sm font-bold text-blue dark:bg-blue-950/60 dark:text-blue-300">
                {(reporter?.full_name || incident.reporter).split(' ').filter(Boolean).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy dark:text-white">{reporter?.full_name || incident.reporter}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500"><Phone size={12} className="shrink-0" />{reporter?.phone || incident.reporter_phone || 'No phone number stored'}</p>
                {reporter?.barangay && <p className="mt-0.5 truncate text-[10px] text-slate-400">Barangay: {reporter.barangay}</p>}
              </div>
            </div>
          </section>

          <section className="surface p-5">
            <SectionHeading icon={ImageIcon} title="Photo evidence" detail={`${attachments.length} stored`} />
            {photos.loading
              ? <div className="grid grid-cols-2 gap-2"><LoadingSkeleton className="aspect-square w-full rounded-xl" /><LoadingSkeleton className="aspect-square w-full rounded-xl" /></div>
              : photos.error
                ? <p className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{photos.error}</p>
                : attachments.length === 0
                  ? <EmptyState title="No photos attached" detail="Residents can attach evidence when they submit the report." />
                  : <div className="grid grid-cols-2 gap-2">
                    {attachments.map((photo) => photo.url
                      ? <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.original_name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-slate-900/70 px-2 py-1 text-[9px] text-white">{photo.original_name}</span>
                      </a>
                      : <div key={photo.id} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-2 text-center text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-900/30">
                        <ImageIcon size={18} /><span className="mt-1 truncate">{photo.original_name}</span>
                      </div>)}
                  </div>}
          </section>

          <section className="surface p-5">
            <SectionHeading icon={Shield} title="Record metadata" />
            <dl className="space-y-2 text-[11px]">
              <MetaRow label="Incident id" value={incident.id} />
              <MetaRow label="Ticket id" value={ticketRow?.id ?? 'Not created'} />
              <MetaRow label="Verified by" value={verifier?.full_name ?? (incident.verified_at ? 'Staff' : 'Not verified')} />
              <MetaRow label="Resolved at" value={incident.resolved_at ? `${dayLabel(incident.resolved_at)} · ${relativeTime(incident.resolved_at)}` : 'Not resolved'} />
              <MetaRow label="Your role" value={roleLabel(workspace.data?.profile?.role ?? null)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
    {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
  </AppShell>;
}

/** The AI's 0–3 score per metric, and the fixed rule that turned them into the severity. */
function SeverityMetrics({ metrics }: { metrics: Record<string, number | string> }) {
  const total = METRICS.reduce((sum, metric) => sum + Number(metrics[metric.key] ?? 0), 0);
  return <div className="mt-3 rounded-lg border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
    <table className="w-full text-left text-[11px]">
      <thead><tr className="text-slate-400"><th className="pb-1 font-semibold">Metric</th><th className="pb-1 font-semibold">Score</th><th className="pb-1 font-semibold">Meaning</th></tr></thead>
      <tbody>
        {METRICS.map((metric) => {
          const score = Number(metrics[metric.key] ?? 0);
          return <tr key={metric.key} className="align-top">
            <td className="py-0.5 pr-3 font-semibold" title={metric.basis}>{metric.label}</td>
            <td className="py-0.5 pr-3">{score}/3</td>
            <td className="py-0.5">{metric.levels[score] ?? ''}</td>
          </tr>;
        })}
        <tr><td className="pt-1 pr-3 font-bold">Total</td><td className="pt-1 pr-3 font-bold">{total}/15</td><td /></tr>
      </tbody>
    </table>
    {typeof metrics.photo_findings === 'string' && <p className="mt-2"><strong>Photos:</strong> {metrics.photo_findings}</p>}
    <p className="mt-2 text-[10px] text-slate-400">Severity rule: {SEVERITY_RULE.map((rule) => `${rule.severity.toUpperCase()} if ${rule.when.toLowerCase()}`).join('; ')}.</p>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</p></div>;
}
function MetaRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="shrink-0 text-slate-400">{label}</dt><dd className="truncate text-right font-semibold text-slate-600 dark:text-slate-300">{value}</dd></div>;
}
function SectionHeading({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <div className="mb-4 flex items-center gap-2">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300"><Icon size={16} /></span>
    <div><h3 className="text-sm font-bold text-navy dark:text-white">{title}</h3>{detail && <p className="text-[10px] text-slate-400">{detail}</p>}</div>
  </div>;
}
function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-100/65 p-3 dark:bg-slate-900/45"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{value}</p></div>;
}
