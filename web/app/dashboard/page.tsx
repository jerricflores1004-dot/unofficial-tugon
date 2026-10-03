import { AppShell } from '@/components/app-shell';
import { DashboardView } from '@/components/dashboard-view';

export default function DashboardPage() {
  return <AppShell title="Operations dashboard" eyebrow="Operations / Overview"><DashboardView /></AppShell>;
}
