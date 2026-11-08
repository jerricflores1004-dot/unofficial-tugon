import { AppShell } from '@/components/app-shell';
import { ResponderView } from '@/components/responder-view';

export default function ResponderPage() {
  return (
    <AppShell title="Dispatches" eyebrow="Agency / Incoming">
      <ResponderView />
    </AppShell>
  );
}