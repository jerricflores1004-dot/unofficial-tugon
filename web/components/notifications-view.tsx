'use client';

import { useMemo, useState } from 'react';
import { Activity, Bell, CloudRain, MessageSquare, Radio, Siren, type LucideIcon } from 'lucide-react';
import { describeError, sendResource } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { mapNotification } from '@/lib/mappers';
import { relativeTime } from '@/lib/format';
import type { AppNotification, Pulse, WorkspaceSummary } from '@/lib/types';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, Toast } from './ui';

const ICONS = {
  emergency_alert: Siren,
  report_confirmation: Activity,
  status_update: Activity,
  announcement: CloudRain,
} as const;

export function NotificationsView() {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useApi<Record<string, any>[]>('/api/notifications');
  const workspace = useApi<WorkspaceSummary>('/api/workspace/summary');
  const pulse = useApi<Pulse>('/api/analytics/operations-pulse');
  const items = useMemo(() => (feed.data ?? []).map(mapNotification), [feed.data]);
  const unread = items.filter((item) => item.unread).length;

  async function markAllRead() {
    setBusy(true);
    try {
      const result = await sendResource<{ updated: number }>('/api/notifications/read-all', 'PATCH');
      setToast(`${result?.updated ?? 0} notification${result?.updated === 1 ? '' : 's'} marked as read.`);
      feed.reload();
      workspace.reload();
      pulse.reload();
    } catch (cause) { setToast(describeError(cause)); } finally { setBusy(false); }
  }

  async function markRead(item: AppNotification) {
    if (!item.unread) return;
    try {
      await sendResource(`/api/notifications/${item.id}/read`, 'PATCH');
      feed.reload();
      workspace.reload();
      pulse.reload();
    } catch (cause) { setToast(describeError(cause)); }
  }

  if (feed.error) return <ErrorState detail={feed.error} onRetry={feed.reload} />;

  const integrations = workspace.data?.integrations;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 p-5 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-navy dark:text-white">Notifications</h3>
          <p className="mt-1 text-xs text-slate-500">{feed.loading ? 'Loading from the database…' : `${unread} unread of ${items.length} stored notifications`}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={markAllRead} disabled={busy || unread === 0}>{busy ? 'Updating…' : 'Mark all as read'}</Button>
      </div>

      {feed.loading && items.length === 0
        ? <div className="space-y-2 p-5">{[0, 1, 2].map((row) => <LoadingSkeleton key={row} className="h-16 w-full" />)}</div>
        : items.length === 0
          ? <div className="p-6"><EmptyState title="No notifications yet" detail="Notification history is written to the database when incidents change or alerts are sent." action={<Button variant="secondary" size="sm" onClick={feed.reload}>Refresh</Button>} /></div>
          : <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {items.map((item) => {
              const Icon = ICONS[item.notification_type] ?? Activity;
              return <button key={item.id} onClick={() => void markRead(item)} className={`flex w-full gap-3 p-5 text-left transition-colors hover:bg-white/50 dark:hover:bg-slate-800/40 ${item.unread ? 'bg-blue-50/35 dark:bg-blue-950/10' : ''}`}>
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.notification_type === 'emergency_alert' ? 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300' : item.notification_type === 'announcement' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300'}`}><Icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</span>{item.unread && <i className="h-2 w-2 shrink-0 rounded-full bg-blue" />}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.body}</span>
                  <span className="mt-2 block text-[10px] text-slate-400">{item.notification_type.replace(/_/g, ' ')} · {relativeTime(item.created_at)}</span>
                </span>
              </button>;
            })}
          </div>}
    </div>

    <div className="surface p-5">
      <PanelHeader title="Notification channels" detail="Configuration reported by the server" />
      <div className="space-y-3">
        <Channel icon={Bell} label="Push notifications" detail="Firebase Cloud Messaging" state={integrations ? (integrations.push ? 'Configured' : 'Server key not set') : undefined} enabled={integrations?.push ?? false} />
        <Channel icon={MessageSquare} label="In-app alerts" detail="Stored in the notifications table" state={integrations?.database ? 'Database available' : 'Database not configured'} enabled={integrations?.database ?? false} />
        <Channel icon={Radio} label="Realtime feed" detail="Supabase Realtime" state={integrations?.realtime ? 'Subscribed by the shell' : 'Unavailable'} enabled={integrations?.realtime ?? false} />
      </div>
      <div className="mt-5 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
        <p className="text-xs font-bold text-blue-800 dark:text-blue-200">Delivery counts</p>
        <dl className="mt-2 space-y-1 text-[11px] text-blue-700/80 dark:text-blue-300/80">
          <div className="flex justify-between gap-2"><dt>Registered devices</dt><dd className="font-bold">{pulse.loading ? '—' : pulse.data?.notification_devices ?? 0}</dd></div>
          <div className="flex justify-between gap-2"><dt>Stored notifications</dt><dd className="font-bold">{pulse.loading ? '—' : pulse.data?.notifications_unread ?? 0} unread</dd></div>
          <div className="flex justify-between gap-2"><dt>Your unread alerts</dt><dd className="font-bold">{workspace.loading ? '—' : workspace.data?.unread_notifications ?? 0}</dd></div>
        </dl>
        <p className="mt-2 text-[10px] leading-4 text-blue-700/70 dark:text-blue-300/70">Every send is written to the notifications table before delivery is attempted, so history survives provider outages.</p>
      </div>
      {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
    </div>
  </div>;
}

function Channel({ icon: Icon, label, detail, enabled, state }: { icon: LucideIcon; label: string; detail: string; enabled: boolean; state?: string }) {
  return <div className="flex items-center gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300"><Icon size={15} /></span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="truncate text-[10px] text-slate-500">{state ?? detail}</p>
    </div>
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
  </div>;
}
