import { randomInt } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;

export const TEAM_KEYS = ['alpha', 'bravo', 'charlie'] as const;
export type TeamKey = (typeof TEAM_KEYS)[number];
export const TEAM_NAMES: Record<TeamKey, string> = {
  alpha: 'Team Alpha',
  bravo: 'Team Bravo',
  charlie: 'Team Charlie',
};

// No look-alike characters (0/O, 1/l/I) so it is easy to read out over radio.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export type FieldTeamDto = {
  id: string;
  name: string;
  team: TeamKey | null;
  email: string | null;
  contact_number: string | null;
  members: string[];
  status: string;
  is_active: boolean;
  current_incident: { id: string; label: string } | null;
  last_check_in: string | null;
};

export async function loadFieldTeams(admin: SupabaseClient, id?: string): Promise<FieldTeamDto[]> {
  let query = admin.from('field_teams').select('*');
  if (id) query = query.eq('id', id);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const userIds = rows.map((row) => row.user_id).filter(Boolean) as string[];
  const incidentIds = rows.map((row) => row.current_incident_id).filter(Boolean) as string[];

  const users = new Map<string, Row>();
  if (userIds.length > 0) {
    const { data: found } = await admin.from('users').select('id, email, team').in('id', userIds);
    (found ?? []).forEach((row: Row) => users.set(row.id, row));
  }

  const incidents = new Map<string, Row>();
  if (incidentIds.length > 0) {
    const { data: found } = await admin.from('incidents').select('id, incident_type, barangay').in('id', incidentIds);
    (found ?? []).forEach((row: Row) => incidents.set(row.id, row));
  }

  return rows.map((row) => {
    const user = users.get(row.user_id);
    const incident = incidents.get(row.current_incident_id);
    return {
      id: row.id,
      name: row.name,
      team: (user?.team ?? null) as TeamKey | null,
      email: user?.email ?? null,
      contact_number: row.contact_number ?? null,
      members: Array.isArray(row.members) ? row.members.map(String) : [],
      status: row.status ?? 'offline',
      is_active: row.is_active !== false,
      current_incident: incident
        ? { id: incident.id, label: `${incident.incident_type ?? 'Incident'}${incident.barangay ? ` - ${incident.barangay}` : ''}` }
        : null,
      last_check_in: row.last_check_in ?? null,
    };
  });
}

/** Signs the account out everywhere. Returns false if the SQL function from step 1 is missing. */
export async function revokeSessions(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await admin.rpc('revoke_user_sessions', { target: userId });
  if (error) {
    console.error('REVOKE SESSIONS ERROR:', error.message);
    return false;
  }
  return true;
}

export async function logAction(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await admin.from('system_logs').insert({
    actor_id: actorId,
    action,
    entity_type: 'field_team',
    entity_id: entityId,
    metadata,
  });
  if (error) console.error('AUDIT LOG ERROR:', error.message);
}