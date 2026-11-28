import { AppShell } from '@/components/app-shell';
import { IncidentsView } from '@/components/incidents-view';

// Reports the AI flagged as likely false. They are kept here, not deleted, so admins can review
// them: dispatch one that is real (it then returns to the incident queue) or reject it.
export default function FlaggedReportsPage() {
  return <AppShell title="Flagged reports" eyebrow="Operations / Flagged reports"><IncidentsView flagged /></AppShell>;
}
