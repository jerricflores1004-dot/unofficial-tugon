'use client';

import type { LucideIcon } from 'lucide-react';

const ACCENTS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  blue: 'bg-blue-soft text-blue dark:bg-blue-950/60 dark:text-blue-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  red: 'bg-red-100 text-critical dark:bg-red-950/60 dark:text-red-300',
};

export function MiniStat({ icon: Icon, label, value, detail, accent = 'blue', loading = false }: {
  icon: LucideIcon; label: string; value: string | number; detail?: string; accent?: string; loading?: boolean;
}) {
  return <div className="surface flex items-center gap-3 p-4">
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ACCENTS[accent] ?? ACCENTS.blue}`}><Icon size={19} /></span>
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-xl font-bold text-navy dark:text-white">{loading ? '—' : value}</p>
      {detail && <p className="mt-0.5 truncate text-[10px] text-slate-400">{detail}</p>}
    </div>
  </div>;
}
