export type Role = 'resident' | 'staff' | 'admin' | 'department_head';
export type IncidentStatus = 'pending' | 'verified' | 'responding' | 'resolved' | 'closed' | 'rejected';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

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
  reported_at: string;
  affected_people: number;
  description: string;
};

export type Kpi = { label: string; value: string; change: string; trend: 'up' | 'down' | 'steady'; detail: string };
