# TUGON user manual

## Staff workflow

1. Sign in with your Supabase Auth account. The sidebar status pill reads
   **Live** when Realtime is connected, **Connecting** while it negotiates,
   **Offline** if the connection dropped, and **No database** if the Supabase
   environment variables are missing. Only **Live** and **Connecting** mean the
   workspace is serving real data.
2. Start on Dashboard for pending verification, active response counts, and critical alerts.
3. Open Incidents. Search by ticket, location, barangay, reporter, or responder. Filter by status or priority.
4. Open a ticket to confirm what happened, where, severity, affected people, photos, reporter details, assignment, and timeline.
5. Verify or reject the report. Assign a responder and add internal updates. Every mutation is logged.
6. Use Live map for spatial awareness. Select a marker to open the incident detail.
7. Use Notifications for operational alerts. Use Reports for authorized exports and oversight.

## Roles

- **Resident:** create reports, see their reports, announcements, notifications, profile, and feedback.
- **Staff:** verify incidents, manage tickets/responders, view map, send notifications.
- **Admin:** users, role/access, settings, logs, monitoring and backup administration.
- **Department head:** analytics, announcements, feedback, departmental reports and oversight.

## Resident mobile workflow

The red report action is available from Home. The grouped form asks for the
incident type, a description, the number of people affected, the barangay, the
exact location, severity, and photo evidence. The incident-type list is loaded
from the database; if no types have been configured yet the field becomes a free
text box. Priority is not chosen by the resident — PostgreSQL derives it from
severity and vulnerable groups.

Home shows a real sync card rather than a fixed status: **SYNCED** when every
report is stored, *N* **WAITING** with a **Sync now** action when reports are
queued on the device, and **CHECKING** while the queue is read. Announcements and
notifications are likewise read from the database, so an empty list means nothing
has been published — the app never fills the screen with placeholder alerts.
