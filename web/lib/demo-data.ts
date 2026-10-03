import type { Incident, Kpi } from './types';

export const demoKpis: Kpi[] = [
  { label: 'Total incidents', value: '248', change: '+12.4%', trend: 'up', detail: 'vs. last 30 days' },
  { label: 'Pending verification', value: '18', change: '+3', trend: 'up', detail: 'requires review' },
  { label: 'Active responses', value: '27', change: '-8.2%', trend: 'down', detail: 'vs. yesterday' },
  { label: 'Resolved today', value: '41', change: '+16.7%', trend: 'up', detail: 'above daily average' },
  { label: 'Critical incidents', value: '06', change: '2 new', trend: 'up', detail: 'immediate attention' }
];

export const demoIncidents: Incident[] = [
  { id: 'inc-001', ticket_id: 'TGN-20261003-0026', type: 'Flash flood', location: 'Purok 4, Brgy. Pulong Niogan', barangay: 'Pulong Niogan', status: 'responding', priority: 'critical', severity: 'critical', reporter: 'Maria Santos', reporter_phone: '0917 555 0182', assigned_to: 'Team Alpha · Rescue 01', reported_at: '2026-10-03T09:42:00+08:00', affected_people: 14, description: 'Rapidly rising water has entered several ground-floor homes near the creek.' },
  { id: 'inc-002', ticket_id: 'TGN-20261003-0025', type: 'Medical emergency', location: 'Mabini National High School', barangay: 'Poblacion', status: 'verified', priority: 'high', severity: 'high', reporter: 'Jun Reyes', reporter_phone: '0918 320 1140', assigned_to: 'MDRRMO Medic 02', reported_at: '2026-10-03T09:18:00+08:00', affected_people: 1, description: 'Student with difficulty breathing needs urgent transport assistance.' },
  { id: 'inc-003', ticket_id: 'TGN-20261003-0024', type: 'Landslide', location: 'Sitio Balanban, Brgy. Anilao Proper', barangay: 'Anilao Proper', status: 'pending', priority: 'high', severity: 'high', reporter: 'Rogelio Cruz', reporter_phone: '0920 824 6651', assigned_to: null, reported_at: '2026-10-03T08:57:00+08:00', affected_people: 8, description: 'Soil and rocks blocking one lane of the access road after continuous rain.' },
  { id: 'inc-004', ticket_id: 'TGN-20261003-0023', type: 'Structural damage', location: 'Purok 2, Brgy. Mainaga', barangay: 'Mainaga', status: 'responding', priority: 'medium', severity: 'medium', reporter: 'Liza Mendoza', reporter_phone: '0917 901 4472', assigned_to: 'Engineering Unit', reported_at: '2026-10-03T08:25:00+08:00', affected_people: 5, description: 'Roofing sheets were displaced and electrical lines are exposed.' },
  { id: 'inc-005', ticket_id: 'TGN-20261003-0022', type: 'Fire', location: 'Market road, Brgy. Ligaya', barangay: 'Ligaya', status: 'resolved', priority: 'critical', severity: 'critical', reporter: 'Benny Flores', reporter_phone: '0919 661 2034', assigned_to: 'BFP Mabini', reported_at: '2026-10-03T07:44:00+08:00', affected_people: 22, description: 'Small commercial fire contained by responding fire volunteers.' },
  { id: 'inc-006', ticket_id: 'TGN-20261003-0021', type: 'Missing person', location: 'Anilao beach access, Brgy. Anilao East', barangay: 'Anilao East', status: 'verified', priority: 'medium', severity: 'medium', reporter: 'Paolo Garcia', reporter_phone: '0927 110 3381', assigned_to: 'Search Team Bravo', reported_at: '2026-10-03T07:19:00+08:00', affected_people: 1, description: 'Family is unable to locate a 17-year-old after the morning swim.' },
  { id: 'inc-007', ticket_id: 'TGN-20261003-0020', type: 'Power outage', location: 'Brgy. Saguing', barangay: 'Saguing', status: 'closed', priority: 'low', severity: 'low', reporter: 'Nora Villanueva', reporter_phone: '0917 632 8970', assigned_to: 'Meralco Liaison', reported_at: '2026-10-03T06:41:00+08:00', affected_people: 0, description: 'Localized outage reported after a fallen branch crossed distribution lines.' },
  { id: 'inc-008', ticket_id: 'TGN-20261003-0019', type: 'Flooding', location: 'Coastal road, Brgy. Ligaya', barangay: 'Ligaya', status: 'verified', priority: 'high', severity: 'high', reporter: 'Carmen Diaz', reporter_phone: '0918 552 2211', assigned_to: 'Team Charlie · Rescue 03', reported_at: '2026-10-03T06:18:00+08:00', affected_people: 31, description: 'Road is no longer passable for small vehicles due to tidal flooding.' }
];

export const incidentTrend = [
  { day: 'Sep 27', reports: 18, resolved: 12 }, { day: 'Sep 28', reports: 24, resolved: 16 }, { day: 'Sep 29', reports: 19, resolved: 14 },
  { day: 'Sep 30', reports: 31, resolved: 22 }, { day: 'Oct 01', reports: 27, resolved: 20 }, { day: 'Oct 02', reports: 36, resolved: 28 }, { day: 'Oct 03', reports: 29, resolved: 25 }
];
export const barangayTrend = [
  { name: 'Ligaya', value: 46 }, { name: 'Poblacion', value: 38 }, { name: 'Anilao Proper', value: 31 }, { name: 'Mainaga', value: 27 }, { name: 'Pulong Niogan', value: 24 }
];
export const priorityMix = [
  { name: 'Critical', value: 6, color: '#B91C1C' }, { name: 'High', value: 48, color: '#EA580C' }, { name: 'Medium', value: 91, color: '#D97706' }, { name: 'Low', value: 103, color: '#16A34A' }
];

export const notifications = [
  { id: 'n1', title: 'Critical incident verified', body: 'Flash flood reported in Pulong Niogan requires immediate response.', time: '4 min ago', type: 'critical', unread: true },
  { id: 'n2', title: 'Response team updated', body: 'Team Alpha accepted assignment TGN-20261003-0026.', time: '12 min ago', type: 'info', unread: true },
  { id: 'n3', title: 'Rainfall advisory', body: 'PAGASA rainfall warning remains in effect until 6:00 PM.', time: '38 min ago', type: 'warning', unread: false }
];
