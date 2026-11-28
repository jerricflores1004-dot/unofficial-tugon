'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Bell, ChevronDown, ChevronLeft, ChevronRight, FileBarChart2, Flag, LayoutDashboard, LogOut, Map,
  Menu, Moon, Radio, Search, Settings, Shield, Siren, Sun, Ticket, Users, X, type LucideIcon,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';
import { sendResource } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { initials, roleLabel, agencyLabel, teamLabel } from '@/lib/mappers';
import type { WorkspaceSummary } from '@/lib/types';

type NavEntry = { label: string; href: string; icon: LucideIcon; badge?: number };

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3" aria-label="TUGON home">
    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-white shadow-lg shadow-navy/20">
      <Shield size={20} strokeWidth={2.1} />
      <span className="absolute right-[9px] top-[11px] h-1.5 w-1.5 rounded-full bg-emergency" />
    </span>
    {!compact && <span><span className="block text-[17px] font-bold tracking-[.18em] text-navy dark:text-white">TUGON</span><span className="block text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">MDRRMO Mabini</span></span>}
  </div>;
}

function NavItem({ item, collapsed }: { item: NavEntry; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
  const Icon = item.icon;
  return <Link href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={`focus-ring group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150 ${collapsed ? 'justify-center' : ''} ${active ? 'bg-blue text-white shadow-md shadow-blue/20' : 'text-slate-600 hover:bg-white/65 hover:text-navy dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
    <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
    {!collapsed && <span className="flex-1">{item.label}</span>}
    {!collapsed && Boolean(item.badge) && <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-blue-soft text-blue dark:bg-blue-950 dark:text-blue-300'}`}>{item.badge}</span>}
    {collapsed && Boolean(item.badge) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emergency" aria-label={`${item.badge} ${item.label.toLowerCase()} needing attention`} />}
  </Link>;
}

export function AppShell({ children, title, eyebrow, action, variant }: { children: React.ReactNode; title: string; eyebrow?: string; action?: React.ReactNode; variant?: 'agency' }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'connected' | 'disconnected' | 'unconfigured'>(isSupabaseConfigured ? 'connecting' : 'unconfigured');
  const summary = useApi<WorkspaceSummary>('/api/workspace/summary');
  const { reload: reloadSummary } = summary;
  const profile = summary.data?.profile ?? null;
  const agencyAccount = variant === 'agency' || profile?.role === 'department_head';
  const roleText = summary.loading && !profile ? 'Loading…' : roleLabel(profile?.role ?? null);
  const displayName = profile?.full_name || profile?.email || 'Signed-in user';
  const refresh = useCallback(() => reloadSummary(), [reloadSummary]);

  useEffect(() => {
    const saved = localStorage.getItem('tugon-theme');
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : preferDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    const client = createClient();
    if (!client) { setRealtimeState('unconfigured'); return; }
    const channel = client.channel('tugon-operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refresh)
      .subscribe((status) => setRealtimeState(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' ? 'disconnected' : 'connecting'));
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  // Agency accounts (BFP, PNP, Coast Guard) only get the dispatch inbox.
  const primaryNav: NavEntry[] = agencyAccount
    ? [{ label: 'Dispatches', href: '/responder', icon: Radio }]
    : [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Incidents', href: '/incidents', icon: Siren, badge: summary.data?.attention_incidents ?? 0 },
        { label: 'Flagged reports', href: '/flagged', icon: Flag },
        { label: 'Tickets', href: '/tickets', icon: Ticket },
        { label: 'Responders', href: '/responders', icon: Users },
        { label: 'Live map', href: '/map', icon: Map },
        { label: 'Reports', href: '/reports', icon: FileBarChart2 },
      ];
  const systemNav: NavEntry[] = agencyAccount
    ? []
    : [
        { label: 'Notifications', href: '/notifications', icon: Bell, badge: summary.data?.unread_notifications ?? 0 },
        { label: 'Settings', href: '/settings', icon: Settings },
      ];

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('tugon-theme', next ? 'dark' : 'light');
  }

  async function signOut() {
    try { await sendResource('/api/auth/logout', 'POST'); } catch { /* the session cookie is cleared server-side either way */ }
    router.replace('/login');
    router.refresh();
  }

  const connection = realtimeState === 'connected'
    ? { label: 'Live', dot: 'bg-emerald-500', box: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' }
    : realtimeState === 'connecting'
      ? { label: 'Connecting', dot: 'bg-amber-500', box: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' }
      : realtimeState === 'unconfigured'
        ? { label: 'No database', dot: 'bg-slate-400', box: 'border-slate-200/70 bg-slate-50/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300' }
        : { label: 'Offline', dot: 'bg-red-500', box: 'border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' };

  return <div className="min-h-screen bg-canvas dark:bg-[#111827]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/60 bg-[#e8edf3]/95 px-4 py-5 backdrop-blur-xl transition-transform duration-200 dark:border-slate-800 dark:bg-[#151f2f]/95 lg:translate-x-0 ${collapsed ? 'lg:w-[80px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`mb-9 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
        <Logo compact={collapsed} />
        {!collapsed && <button onClick={() => setMobileOpen(false)} className="focus-ring rounded-lg p-2 text-slate-500 hover:bg-white/70 lg:hidden" aria-label="Close menu"><X size={18} /></button>}
      </div>
      <div className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 ${collapsed ? 'text-center' : ''}`}>{collapsed ? '•' : 'Operations'}</div>
      <nav className="space-y-1" aria-label="Primary navigation">{primaryNav.map((item) => <NavItem item={item} collapsed={collapsed} key={item.href} />)}</nav>
      {systemNav.length > 0 && <>
        <div className={`mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 ${collapsed ? 'text-center' : ''}`}>{collapsed ? '•' : 'Workspace'}</div>
        <nav className="space-y-1" aria-label="Workspace navigation">{systemNav.map((item) => <NavItem item={item} collapsed={collapsed} key={item.href} />)}</nav>
      </>}
      <div className="mt-auto space-y-3">
        {!collapsed && !agencyAccount && <div className="rounded-2xl border border-blue/10 bg-blue/5 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-navy dark:text-blue-100"><span className="grid h-6 w-6 place-items-center rounded-lg bg-blue text-white"><Radio size={14} /></span>Needs attention</div>
          {summary.loading && <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">Loading database counts…</p>}
          {summary.error && <p className="text-[11px] leading-4 text-red-600 dark:text-red-300">{summary.error}</p>}
          {!summary.loading && !summary.error && <dl className="space-y-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            <div className="flex justify-between gap-2"><dt>Open incidents</dt><dd className="font-bold text-navy dark:text-white">{summary.data?.attention_incidents ?? 0}</dd></div>
            <div className="flex justify-between gap-2"><dt>Unread alerts</dt><dd className="font-bold text-navy dark:text-white">{summary.data?.unread_notifications ?? 0}</dd></div>
          </dl>}
        </div>}
        <div className={`flex items-center gap-3 rounded-xl border border-white/80 bg-white/45 p-2 dark:border-slate-700 dark:bg-slate-800/70 ${collapsed ? 'justify-center' : ''}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">{initials(displayName)}</span>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{displayName}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{roleLabel(profile?.role ?? null)}{profile?.agency ? ` · ${agencyLabel(profile.agency)}${profile.team ? ` (${teamLabel(profile.team)})` : ''}` : ''}</p></div>}
          {!collapsed && <button onClick={signOut} title="Sign out" className="focus-ring rounded-md p-1.5 text-slate-400 hover:text-emergency" aria-label="Sign out"><LogOut size={15} /></button>}
        </div>
      </div>
      <button onClick={() => setCollapsed(!collapsed)} className="focus-ring absolute -right-3 top-[88px] hidden h-7 w-7 place-items-center rounded-full border border-slate-200 bg-[#f1f5f9] text-slate-500 shadow-md hover:text-blue dark:border-slate-700 dark:bg-[#273449] dark:text-slate-300 lg:grid" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
    <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[260px]'}`}>
      <header className="sticky top-0 z-20 flex h-[76px] items-center gap-3 border-b border-white/70 bg-[#e8edf3]/85 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-[#111827]/85 sm:px-6 lg:px-8">
        <button onClick={() => setMobileOpen(true)} className="focus-ring rounded-xl p-2 text-slate-500 hover:bg-white/65 lg:hidden" aria-label="Open navigation"><Menu size={21} /></button>
        <div className="hidden min-w-0 sm:block"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue">Mabini, Batangas</p><h1 className="truncate text-lg font-bold text-navy dark:text-white">{title}</h1></div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button onClick={() => setSearchOpen(!searchOpen)} className="focus-ring hidden items-center gap-2 rounded-xl border border-white/80 bg-white/55 px-3 py-2 text-xs text-slate-500 shadow-sm hover:text-navy dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400 md:flex" aria-label="Search"><Search size={16} /><span>Search anything</span><kbd className="ml-3 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-slate-600">⌘ K</kbd></button>
          <button onClick={() => setSearchOpen(!searchOpen)} className="focus-ring rounded-xl p-2 text-slate-500 hover:bg-white/65 md:hidden" aria-label="Open search"><Search size={19} /></button>
          <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold sm:flex ${connection.box}`}><span className={`h-2 w-2 rounded-full ${connection.dot}`} />{connection.label}</div>
          <button onClick={toggleTheme} className="focus-ring rounded-xl p-2 text-slate-500 hover:bg-white/65 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Link href={agencyAccount ? '/responder' : '/notifications'} className="focus-ring relative rounded-xl p-2 text-slate-500 hover:bg-white/65 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notifications">
            <Bell size={19} />
            {Boolean(summary.data?.unread_notifications) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-[#e8edf3] bg-emergency dark:border-[#111827]" />}
          </Link>
          <span className="hidden h-8 w-px bg-slate-300 dark:bg-slate-700 sm:block" />
          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)} className="focus-ring flex items-center gap-2 rounded-xl p-1 hover:bg-white/65 dark:hover:bg-slate-800" aria-label="Open profile menu" aria-expanded={profileOpen}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs font-bold text-white">{initials(displayName)}</span>
              <span className="hidden text-left lg:block"><span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{displayName}</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">{roleLabel(profile?.role ?? null)}</span></span>
              <ChevronDown size={14} className="hidden text-slate-400 lg:block" />
            </button>
            {profileOpen && <>
              <button className="fixed inset-0 z-30 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" />
              <div className="absolute right-0 top-12 z-40 w-60 rounded-2xl border border-white bg-[#f1f5f9] p-3 shadow-xl dark:border-slate-700 dark:bg-[#273449]">
                <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{displayName}</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{profile?.email || 'Email unavailable'}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-blue">{roleLabel(profile?.role ?? null)}</p>
                {profile?.agency && <p className="mt-1 text-[11px] text-slate-500">{agencyLabel(profile.agency)}{profile.team ? ` · ${teamLabel(profile.team)}` : ''}</p>}
                {profile?.barangay && <p className="mt-1 text-[11px] text-slate-500">Barangay: {profile.barangay}</p>}
                <button onClick={signOut} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-emergency hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800"><LogOut size={14} /> Sign out</button>
              </div>
            </>}
          </div>
        </div>
      </header>
      {searchOpen && <div className="absolute right-4 top-[68px] z-30 w-[min(420px,calc(100vw-32px))] rounded-2xl border border-white bg-[#f1f5f9] p-3 shadow-xl dark:border-slate-700 dark:bg-[#273449] sm:right-8">
        <label className="sr-only" htmlFor="global-search">Search operations</label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"><Search size={16} className="text-slate-400" /><input autoFocus id="global-search" className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder="Search tickets, locations, responders…" /><kbd className="text-[10px] text-slate-400">ESC</kbd></div>
        <p className="mt-2 px-1 text-[11px] text-slate-500">Search runs against the incidents table in the database.</p>
      </div>}
      <main className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">{eyebrow || 'Operations workspace'}</p><h2 className="text-2xl font-bold tracking-tight text-navy dark:text-white sm:text-[30px]">{title}</h2></div>
          {action}
        </div>
        {children}
      </main>
    </div>
  </div>;
}