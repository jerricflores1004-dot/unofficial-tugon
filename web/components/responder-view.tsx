'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, MapPin, Radio, TriangleAlert, Users } from 'lucide-react';

type Status = 'dispatched' | 'acknowledged' | 'responding' | 'completed' | 'verified';

type Dispatch = {
  id: string;
  status: Status;
  note: string | null;
  dispatched_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  return_note: string | null;
  verified_at: string | null;
  ticket: {
    id: string;
    ticket_number: string;
    notes: string | null;
    incident: {
      id: string;
      incident_type: string;
      description: string;
      barangay: string;
      location_text: string;
      latitude: number | null;
      longitude: number | null;
      priority: string;
      affected_people: number | null;
      reported_at: string;
    } | null;
  } | null;
};

const NEXT: Partial<Record<Status, { to: 'acknowledged' | 'responding'; label: string }>> = {
  dispatched: { to: 'acknowledged', label: 'Acknowledge' },
  acknowledged: { to: 'responding', label: 'Mark responding' },
};

const STATUS_LABEL: Record<Status, string> = {
  dispatched: 'New dispatch',
  acknowledged: 'Acknowledged',
  responding: 'Responding',
  completed: 'Awaiting verification',
  verified: 'Verified',
};

const STATUS_STYLE: Record<Status, string> = {
  dispatched: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  acknowledged: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  responding: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

const CARD =
  'rounded-2xl border border-white/70 bg-[#f1f5f9] p-5 shadow-neumorphic dark:border-slate-700 dark:bg-[#1f2937] dark:shadow-neumorphic-dark';

const BUTTON =
  'rounded-xl bg-blue px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue/20 hover:opacity-90 disabled:opacity-60';

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : '';
}

export function ResponderView() {
  const [items, setItems] = useState<Dispatch[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [report, setReport] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/responder/dispatches', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Unable to load dispatches.');
      setItems(json.data ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dispatches.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function advance(id: string, status: string, completionNote?: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/responder/dispatches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionNote ? { status, completionNote } : { status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Unable to update this dispatch.');
      setReporting(null);
      setReport('');
      setError('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this dispatch.');
    } finally {
      setBusy(null);
    }
  }

  const waiting = items?.filter((item) => item.status === 'dispatched').length ?? 0;

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <TriangleAlert size={16} className="shrink-0" />{error}
        </div>
      )}

      {waiting > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-emergency p-4 text-white shadow-lg">
          <BellRing size={22} className="shrink-0" />
          <p className="text-sm font-bold">
            {waiting} new {waiting === 1 ? 'dispatch is' : 'dispatches are'} waiting for acknowledgement.
          </p>
        </div>
      )}

      {items === null && !error && <p className="text-sm text-slate-500">Loading dispatches...</p>}

      {items?.length === 0 && (
        <div className={`${CARD} text-center`}>
          <Radio size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-navy dark:text-white">No dispatches yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            New dispatches from the MDRRMO appear here automatically.
          </p>
        </div>
      )}

      {items?.map((item) => {
        const incident = item.ticket?.incident ?? null;
        const next = NEXT[item.status];
        const mapUrl = incident?.latitude != null && incident?.longitude != null
          ? `https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`
          : null;
        const isReporting = reporting === item.id;
        return (
          <article key={item.id} className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-blue">
                  {item.ticket?.ticket_number ?? 'Ticket'}
                </p>
                <h3 className="mt-1 text-lg font-bold text-navy dark:text-white">
                  {incident?.incident_type ?? 'Incident'}
                </h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
            </div>

            {incident && (
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>{incident.description}</p>
                <p className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    {incident.location_text}, {incident.barangay}
                    {mapUrl && (
                      <> &middot; <a href={mapUrl} target="_blank" rel="noreferrer" className="font-bold text-blue hover:underline">Open in Maps</a></>
                    )}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="uppercase">Priority: {incident.priority}</span>
                  {incident.affected_people != null && (
                    <span className="flex items-center gap-1"><Users size={13} /> {incident.affected_people} affected</span>
                  )}
                  <span>Reported {when(incident.reported_at)}</span>
                </p>
              </div>
            )}

            {item.note && (
              <p className="mt-3 rounded-xl bg-white/60 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <strong>Message from the MDRRMO:</strong> {item.note}
              </p>
            )}

            {item.return_note && item.status === 'responding' && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>Returned by the MDRRMO:</strong> {item.return_note}
              </p>
            )}

            {item.completion_note && (item.status === 'completed' || item.status === 'verified') && (
              <p className="mt-3 rounded-xl bg-white/60 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <strong>Your completion report:</strong> {item.completion_note}
              </p>
            )}

            {isReporting && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200" htmlFor={`report-${item.id}`}>
                  Completion report
                </label>
                <textarea
                  id={`report-${item.id}`}
                  value={report}
                  onChange={(event) => setReport(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="What was done, what was found, and the final outcome."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setReporting(null); setReport(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    Cancel
                  </button>
                  <button type="button" disabled={busy === item.id || report.trim().length < 5} onClick={() => void advance(item.id, 'completed', report.trim())} className={BUTTON}>
                    {busy === item.id ? 'Submitting...' : 'Submit for verification'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dispatched {when(item.dispatched_at)}
                {item.acknowledged_at && <> &middot; Acknowledged {when(item.acknowledged_at)}</>}
                {item.completed_at && <> &middot; Report submitted {when(item.completed_at)}</>}
                {item.verified_at && <> &middot; Verified {when(item.verified_at)}</>}
                {item.status === 'completed' && <> &middot; Waiting for the MDRRMO to verify</>}
              </p>
              {next && (
                <button type="button" disabled={busy === item.id} onClick={() => void advance(item.id, next.to)} className={BUTTON}>
                  {busy === item.id ? 'Saving...' : next.label}
                </button>
              )}
              {item.status === 'responding' && !isReporting && (
                <button type="button" onClick={() => { setReporting(item.id); setReport(''); }} className={BUTTON}>
                  Report completion
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}