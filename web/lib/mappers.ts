import { format, parseISO } from 'date-fns';
import type {
  Announcement, AppNotification, AuditLog, FeedbackItem, Incident, IncidentPhoto, IncidentStatus,
  IncidentType, IncidentUpdate, Priority, PrioritySlice, Responder, ResponderAvailability,
  ResponseTimePoint, ResponderAgency, ResponderTeam, Severity, SystemSetting, Ticket, TicketStatus, TrendPoint, UserRecord, BarangayStat,
} from './types';

/** Defensive coercion helpers: the database is the only source, but rows may be sparse. */
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
export function dayLabel(value: string): string {
  try { return format(parseISO(value), 'MMM d'); } catch { return value; }
}

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_COLORS: Record<Priority, string> = { critical: '#B91C1C', high: '#EA580C', medium: '#D97706', low: '#16A34A' };

export function asPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : 'low';
}
export function asSeverity(value: unknown): Severity {
  return (['critical', 'high', 'medium', 'low'] as Severity[]).includes(value as Severity) ? (value as Severity) : 'low';
}
export function asIncidentStatus(value: unknown): IncidentStatus {
  const statuses: IncidentStatus[] = ['pending', 'verified', 'responding', 'resolved', 'closed', 'rejected'];
  return statuses.includes(value as IncidentStatus) ? (value as IncidentStatus) : 'pending';
}
export function asTicketStatus(value: unknown): TicketStatus {
  const statuses: TicketStatus[] = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
  return statuses.includes(value as TicketStatus) ? (value as TicketStatus) : 'open';
}
export function asAvailability(value: unknown): ResponderAvailability {
  const values: ResponderAvailability[] = ['available', 'deployed', 'standby', 'offline'];
  return values.includes(value as ResponderAvailability) ? (value as ResponderAvailability) : 'offline';
}

export type Row = Record<string, any>;

export function mapIncident(row: Row): Incident {
  const ticket = first<Row>(row.ticket ?? row.tickets);
  const reporter = first<Row>(row.reporter ?? row.users);
  const responder = first<Row>(row.responder ?? row.responders);
  return {
    id: text(row.id),
    ticket_id: text(ticket?.ticket_number, 'Ticket pending'),
    type: text(row.incident_type, 'Unclassified incident'),
    location: text(row.location_text, 'Location not recorded'),
    barangay: text(row.barangay, 'Barangay not recorded'),
    status: asIncidentStatus(row.status),
    priority: asPriority(row.priority),
    severity: asSeverity(row.severity),
    reporter: text(reporter?.full_name, 'Unknown reporter'),
    reporter_phone: text(reporter?.phone, 'Not provided'),
    assigned_to: nullableText(responder?.name),
    assigned_responder_id: nullableText(row.assigned_responder_id),
    reported_at: text(row.reported_at, new Date(0).toISOString()),
    affected_people: number(row.affected_people),
    description: text(row.description),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    vulnerable_groups: Array.isArray(row.vulnerable_groups) ? row.vulnerable_groups.map((item: unknown) => String(item)) : [],
    verified_at: nullableText(row.verified_at),
    resolved_at: nullableText(row.resolved_at),
    created_at: text(row.created_at, text(row.reported_at)),
  };
}

export function mapIncidentUpdate(row: Row): IncidentUpdate {
  const author = first<Row>(row.author);
  return {
    id: text(row.id),
    message: text(row.message),
    update_type: text(row.update_type, 'internal_note'),
    author: text(author?.full_name, 'System'),
    created_at: text(row.created_at),
  };
}

export function mapIncidentPhoto(row: Row, url: string | null): IncidentPhoto {
  return {
    id: text(row.id),
    original_name: text(row.original_name, 'Attachment'),
    content_type: text(row.content_type, 'image/*'),
    size_bytes: number(row.size_bytes),
    url,
  };
}

export function mapResponder(row: Row): Responder {
  const assigned = row.assigned_incidents;
  return {
    id: text(row.id),
    name: text(row.name, 'Unnamed unit'),
    lead_name: nullableText(row.lead_name),
    unit: text(row.unit, 'Unspecified unit'),
    availability: asAvailability(row.availability),
    current_location: nullableText(row.current_location),
    contact_number: nullableText(row.contact_number),
    last_check_in: nullableText(row.last_check_in),
    assigned_incidents: Array.isArray(assigned) ? assigned.length : number(assigned),
  };
}

export function mapTicket(row: Row): Ticket {
  const incident = first<Row>(row.incident ?? row.incidents);
  const responder = first<Row>(row.responder ?? row.responders);
  const updates = row.updates ?? row.ticket_updates;
  return {
    id: text(row.id),
    ticket_number: text(row.ticket_number, 'Ticket pending'),
    status: asTicketStatus(row.status),
    notes: nullableText(row.notes),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at, text(row.created_at)),
    assigned_to: nullableText(responder?.name),
    incident_id: text(row.incident_id ?? incident?.id),
    incident_type: text(incident?.incident_type, 'Unclassified incident'),
    barangay: text(incident?.barangay, 'Barangay not recorded'),
    priority: asPriority(incident?.priority),
    incident_status: asIncidentStatus(incident?.status),
    affected_people: number(incident?.affected_people),
    updates: Array.isArray(updates) ? updates.length : number(updates),
  };
}

export function mapNotification(row: Row): AppNotification {
  const types = ['report_confirmation', 'status_update', 'emergency_alert', 'announcement'];
  return {
    id: text(row.id),
    title: text(row.title, 'Notification'),
    body: text(row.body),
    notification_type: (types.includes(row.notification_type) ? row.notification_type : 'status_update') as AppNotification['notification_type'],
    unread: row.read_at === null || row.read_at === undefined,
    created_at: text(row.created_at),
  };
}

export function mapAnnouncement(row: Row): Announcement {
  const priorities = ['normal', 'important', 'urgent'];
  return {
    id: text(row.id),
    title: text(row.title, 'Announcement'),
    body: text(row.body),
    priority: (priorities.includes(row.priority) ? row.priority : 'normal') as Announcement['priority'],
    is_published: row.is_published === true,
    published_at: nullableText(row.published_at),
    expires_at: nullableText(row.expires_at),
    created_at: text(row.created_at),
  };
}

export function mapFeedback(row: Row): FeedbackItem {
  const author = first<Row>(row.user ?? row.users);
  return {
    id: text(row.id),
    rating: number(row.rating),
    message: nullableText(row.message),
    author: text(author?.full_name, 'Resident'),
    created_at: text(row.created_at),
  };
}

export function mapAuditLog(row: Row): AuditLog {
  const actor = first<Row>(row.actor);
  return {
    id: text(row.id),
    action: text(row.action, 'event'),
    entity_type: text(row.entity_type, 'system'),
    entity_id: nullableText(row.entity_id),
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
    actor: nullableText(actor?.full_name) ?? nullableText(actor?.email) ?? 'System',
    created_at: text(row.created_at),
  };
}

const AGENCIES: ResponderAgency[] = ['bfp', 'pnp', 'coast_guard', 'mdrrmo'];
const TEAMS: ResponderTeam[] = ['alpha', 'bravo', 'charlie'];

export function mapUser(row: Row): UserRecord {
  const roles = ['resident', 'staff', 'admin', 'department_head'];
  return {
    id: text(row.id),
    email: text(row.email),
    full_name: text(row.full_name, 'Unnamed user'),
    role: (roles.includes(row.role) ? row.role : 'resident') as UserRecord['role'],
    agency: (AGENCIES.includes(row.agency) ? row.agency : null) as UserRecord['agency'],
    team: (TEAMS.includes(row.team) ? row.team : null) as UserRecord['team'],
    barangay: nullableText(row.barangay),
    is_active: row.is_active !== false,
    created_at: text(row.created_at),
  };
}

export function agencyLabel(agency: ResponderAgency | null): string {
  switch (agency) {
    case 'bfp': return 'Bureau of Fire Protection';
    case 'pnp': return 'Philippine National Police';
    case 'coast_guard': return 'Philippine Coast Guard';
    case 'mdrrmo': return 'MDRRMO Mabini';
    default: return '—';
  }
}

export function teamLabel(team: ResponderTeam | null): string {
  switch (team) {
    case 'alpha': return 'Team Alpha';
    case 'bravo': return 'Team Bravo';
    case 'charlie': return 'Team Charlie';
    default: return '—';
  }
}

export function mapIncidentType(row: Row): IncidentType {
  return { id: text(row.id), label: text(row.label), sort_order: number(row.sort_order) };
}

export function mapTrend(rows: Row[] | null): TrendPoint[] {
  return (rows || []).map((row) => {
    const day = text(row.day);
    return { day, label: dayLabel(day), reports: number(row.reports), resolved: number(row.resolved) };
  });
}

export function mapPriorityMix(rows: Row[] | null): PrioritySlice[] {
  const counts = new Map<Priority, number>();
  (rows || []).forEach((row) => counts.set(asPriority(row.priority), number(row.total)));
  return PRIORITIES.map((priority) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: counts.get(priority) ?? 0,
    color: PRIORITY_COLORS[priority],
  }));
}

export function mapBarangayStats(rows: Row[] | null): BarangayStat[] {
  return (rows || []).map((row) => ({ name: text(row.barangay, 'Unassigned'), value: number(row.total), critical: number(row.critical) }));
}

export function mapResponseTimes(rows: Row[] | null): ResponseTimePoint[] {
  return (rows || []).map((row) => {
    const day = text(row.day);
    return { day, label: dayLabel(day), median_minutes: number(row.median_minutes), resolved: number(row.resolved) };
  });
}

export function mapSettings(rows: Row[] | null): Record<string, SystemSetting> {
  return (rows || []).reduce<Record<string, SystemSetting>>((accumulator, row) => {
    const key = text(row.key);
    if (key) accumulator[key] = { key, value: row.value, description: nullableText(row.description) };
    return accumulator;
  }, {});
}

export function settingText(settings: Record<string, SystemSetting>, key: string): string {
  const value = settings[key]?.value;
  return typeof value === 'string' ? value : '';
}
export function settingNumber(settings: Record<string, SystemSetting>, key: string, fallback: number): number {
  const value = settings[key]?.value;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
export function settingBool(settings: Record<string, SystemSetting>, key: string, fallback: boolean): boolean {
  const value = settings[key]?.value;
  return typeof value === 'boolean' ? value : fallback;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function roleLabel(role: string | null): string {
  switch (role) {
    case 'admin': return 'Administrator';
    case 'department_head': return 'Department head';
    case 'staff': return 'Operations staff';
    case 'resident': return 'Resident';
    default: return 'No active profile';
  }
}
