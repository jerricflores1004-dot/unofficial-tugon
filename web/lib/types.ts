export type Role = 'resident' | 'staff' | 'admin' | 'department_head';
export type ResponderAgency = 'bfp' | 'pnp' | 'coast_guard' | 'mdrrmo';
export type ResponderTeam = 'alpha' | 'bravo' | 'charlie';
export type IncidentStatus = 'pending' | 'verified' | 'responding' | 'resolved' | 'closed' | 'rejected';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ResponderAvailability = 'available' | 'deployed' | 'standby' | 'offline';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type NotificationType = 'report_confirmation' | 'status_update' | 'emergency_alert' | 'announcement';

export type Incident = {
  id: string;
  ticket_id: string;
  type: string;
  location: string;
  barangay: string;
  status: IncidentStatus;
  priority: Priority;
  severity: Severity;
  reporter: string;
  reporter_phone: string;
  assigned_to: string | null;
  assigned_responder_id: string | null;
  reported_at: string;
  affected_people: number;
  description: string;
  latitude: number | null;
  longitude: number | null;
  vulnerable_groups: string[];
  verified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  ai_reason: string | null;
  ai_agencies: string[];
  ai_source: 'ai' | 'rules' | null;
  ai_triaged_at: string | null;
  ai_metrics: Record<string, number | string> | null;
};

export type IncidentUpdate = {
  id: string;
  message: string;
  update_type: string;
  author: string;
  created_at: string;
};

export type IncidentPhoto = { id: string; original_name: string; content_type: string; size_bytes: number; url: string | null };

export type Responder = {
  id: string;
  name: string;
  lead_name: string | null;
  unit: string;
  availability: ResponderAvailability;
  current_location: string | null;
  contact_number: string | null;
  last_check_in: string | null;
  assigned_incidents: number;
};

export type Ticket = {
  id: string;
  ticket_number: string;
  status: TicketStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  incident_id: string;
  incident_type: string;
  barangay: string;
  priority: Priority;
  incident_status: IncidentStatus;
  affected_people: number;
  updates: number;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  notification_type: NotificationType;
  unread: boolean;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type FeedbackItem = {
  id: string;
  rating: number;
  message: string | null;
  author: string;
  created_at: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  actor: string;
  created_at: string;
};

export type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  agency: ResponderAgency | null;
  team: ResponderTeam | null;
  barangay: string | null;
  is_active: boolean;
  created_at: string;
};

export type IncidentType = { id: string; label: string; sort_order: number };

export type TrendPoint = { day: string; label: string; reports: number; resolved: number };
export type PrioritySlice = { name: string; value: number; color: string };
export type BarangayStat = { name: string; value: number; critical: number };
export type ResponseTimePoint = { day: string; label: string; median_minutes: number; resolved: number };

export type Summary = {
  period_days: number;
  total_incidents: number;
  pending_verification: number;
  active_responses: number;
  verified_open: number;
  resolved_today: number;
  critical_incidents: number;
  period_reports: number;
  period_reports_previous: number;
  period_resolved: number;
  period_resolved_previous: number;
  incidents_this_month: number;
  resolution_rate: number;
  median_response_minutes: number;
};

export type Pulse = {
  responders_total: number;
  responders_available: number;
  responders_deployed: number;
  responders_standby: number;
  responders_offline: number;
  responders_checked_in_24h: number;
  tickets_total: number;
  tickets_open: number;
  tickets_awaiting_assignment: number;
  tickets_in_field: number;
  tickets_resolved: number;
  tickets_closed: number;
  tickets_resolved_this_week: number;
  tickets_sla_met: number;
  tickets_sla_measured: number;
  incidents_unassigned: number;
  incidents_geolocated: number;
  users_total: number;
  users_active: number;
  users_deactivated: number;
  users_by_role: Record<string, number>;
  audit_events: number;
  audit_events_24h: number;
  feedback_total: number;
  feedback_last_30_days: number;
  feedback_average: number;
  announcements_published: number;
  announcements_drafts: number;
  incident_types_active: number;
  notification_devices: number;
  notifications_unread: number;
};

export type Profile = { id: string; email: string; full_name: string; role: Role; agency: ResponderAgency | null; team: ResponderTeam | null; barangay: string | null; is_active: boolean };

export type Integrations = { database: boolean; realtime: boolean; storage: boolean; push: boolean; maps: boolean };

export type WorkspaceSummary = {
  profile: Profile | null;
  role: Role | null;
  is_staff: boolean;
  attention_incidents: number;
  unread_notifications: number;
  integrations: Integrations;
};

export type SystemSetting = { key: string; value: unknown; description: string | null };

export type Kpi = { label: string; value: string; change: string; trend: 'up' | 'down' | 'steady'; detail: string };
