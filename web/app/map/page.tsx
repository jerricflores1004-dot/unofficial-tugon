import { AppShell } from '@/components/app-shell';
import { MapView } from '@/components/map-view';

export default function MapPage() {
  return (
    <AppShell title="Live incident map" eyebrow="Operations / Situation awareness">
      <MapView />
    </AppShell>
  );
}