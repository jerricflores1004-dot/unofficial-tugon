-- TUGON migration 004 — restrict incident location to Mabini, Batangas
-- Apply with: supabase db push
--
-- Purpose: resident reports in the Flutter mobile app should only be accepted
-- when the GPS coordinates fall within the Mabini, Batangas municipal area.
-- The location_text field remains free-text (barangay, street, landmark), but
-- if latitude and longitude are provided they must be inside Mabini bounds.
--
-- Mabini, Batangas approximate bounding box:
--   Latitude:  13.68 – 13.82
--   Longitude: 120.87 – 120.99
--
-- NULL latitude/longitude are still allowed (residents can type the location
-- manually without GPS). Only when both coordinates are present are they
-- validated against the Mabini bounding box.

alter table public.incidents
  add constraint incidents_within_mabini_bounds
  check (
    latitude is null
    or longitude is null
    or (
      latitude between 13.68 and 13.82
      and longitude between 120.87 and 120.99
    )
  );

comment on constraint incidents_within_mabini_bounds on public.incidents is
  'Rejects incident GPS coordinates outside Mabini, Batangas.';
