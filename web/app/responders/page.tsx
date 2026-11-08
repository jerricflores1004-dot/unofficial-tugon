import { AppShell } from '@/components/app-shell';
import { RespondersView } from '@/components/operations-views';
import { AgencyAccounts } from '@/components/agency-accounts';

export default function RespondersPage() {
  return (
    <AppShell title="Responder coordination" eyebrow="Operations / Responders">
      <div className="space-y-5">
        <RespondersView />
        <AgencyAccounts />
      </div>
    </AppShell>
  );
}