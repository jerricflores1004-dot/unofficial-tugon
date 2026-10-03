/**
 * Barrel for the operations workspace views.
 *
 * Each view is database-backed: it reads through the Next.js API routes, which
 * query Supabase/PostgreSQL under row level security. No view carries sample or
 * fallback records.
 */
export { TicketsView } from './tickets-view';
export { RespondersView } from './responders-view';
export { MapView } from './map-view';
export { NotificationsView } from './notifications-view';
export { ReportsView } from './reports-view';
export { SettingsView } from './settings-view';
export { AdminView } from './admin-view';
export { DepartmentHeadView } from './department-head-view';
