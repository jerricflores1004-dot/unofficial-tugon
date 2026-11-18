import { AppShell } from '@/components/app-shell';
import { FieldTeamsView } from '@/components/field-teams-view';
import { AgencyAccounts } from '@/components/agency-accounts';

export default function RespondersPage() {
  return (
    <AppShell title="Responder coordination" eyebrow="Operations / Responders">
      <div className="space-y-5">
        <FieldTeamsView />
        <AgencyAccounts />
      </div>
    </AppShell>
  );
}