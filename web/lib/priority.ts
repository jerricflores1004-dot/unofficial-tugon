import type { Priority, Severity } from './types';

/** Same deterministic rules enforced by the PostgreSQL trigger. */
export function calculatePriority(severity: Severity, vulnerableGroups: string[] = []): Priority {
  if (severity === 'critical') return 'critical';
  if (severity === 'high' && vulnerableGroups.length > 0) return 'critical';
  return severity;
}
