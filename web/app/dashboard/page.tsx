import { AppShell } from '@/components/app-shell';
import { DashboardView } from '@/components/dashboard-view';
import { Button } from '@/components/ui';
import { Download, Plus } from 'lucide-react';

export default function DashboardPage() { return <AppShell title="Operations dashboard" eyebrow="Good morning, Ava" action={<div className="flex gap-2"><Button variant="secondary" size="sm"><Download size={14} /> Export</Button><Button size="sm"><Plus size={15} /> New incident</Button></div>}><DashboardView /></AppShell>; }
