import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { generatePassword, loadFieldTeams, logAction, revokeSessions } from '@/lib/field-teams-server';

const patchSchema = z
  .object({
    contactNumber: z.string().trim().min(7).max(40).nullable().optional(),
    members: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    isActive: z.boolean().optional(),
    resetPassword: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid field team update.');
  const d = parsed.data;
  if (Object.keys(d).length === 0) return badRequest('Nothing to update.');

  const { data: team, error: findError } = await admin.from('field_teams').select('*').eq('id', params.id).maybeSingle();
  if (findError) return badRequest('Unable to load the field team.', 500);
  if (!team) return badRequest('Field team not found.', 404);

  const result: { tempPassword?: string; sessionsRevoked?: boolean } = {};

  // 1. Login account changes first, so a failure leaves the rest untouched.
  if (team.user_id) {
    const authUpdate: Record<string, unknown> = {};
    if (d.isActive !== undefined) authUpdate.ban_duration = d.isActive ? 'none' : '876000h';
    if (d.resetPassword) {
      result.tempPassword = generatePassword();
      authUpdate.password = result.tempPassword;
    }
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(team.user_id, authUpdate);
      if (error) {
        console.error('UPDATE AUTH USER ERROR:', error.message);
        return badRequest('Unable to update the login account.', 500);
      }
    }
    if (d.resetPassword || d.isActive === false) {
      result.sessionsRevoked = await revokeSessions(admin, team.user_id);
    }
  }

  // 2. Database rows
  const teamUpdate: Record<string, unknown> = {};
  const userUpdate: Record<string, unknown> = {};
  if (d.contactNumber !== undefined) {
    teamUpdate.contact_number = d.contactNumber;
    userUpdate.phone = d.contactNumber;
  }
  if (d.members) teamUpdate.members = d.members;
  if (d.isActive !== undefined) {
    teamUpdate.is_active = d.isActive;
    userUpdate.is_active = d.isActive;
    if (!d.isActive) {
      teamUpdate.status = 'offline';
      teamUpdate.current_incident_id = null;
    }
  }

  if (Object.keys(teamUpdate).length > 0) {
    const { error } = await admin.from('field_teams').update(teamUpdate).eq('id', params.id);
    if (error) {
      console.error('UPDATE FIELD TEAM ERROR:', error);
      return badRequest('Unable to update the field team.', 500);
    }
  }
  if (team.user_id && Object.keys(userUpdate).length > 0) {
    const { error } = await admin.from('users').update(userUpdate).eq('id', team.user_id);
    if (error) console.error('UPDATE PROFILE ERROR:', error);
  }

  const action = d.resetPassword ? 'field_team.password_reset' : d.isActive === undefined ? 'field_team.updated' : d.isActive ? 'field_team.activated' : 'field_team.deactivated';
  await logAction(admin, auth.user.id, action, params.id);

  const [dto] = await loadFieldTeams(admin, params.id);
  return NextResponse.json({ data: { team: dto, ...result } });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data: team } = await admin.from('field_teams').select('id, user_id, name').eq('id', params.id).maybeSingle();
  if (!team) return badRequest('Field team not found.', 404);

  const { error: teamError } = await admin.from('field_teams').delete().eq('id', params.id);
  if (teamError) {
    console.error('DELETE FIELD TEAM ERROR:', teamError);
    return badRequest('Unable to delete the field team.', 500);
  }

  if (team.user_id) {
    await admin.from('users').delete().eq('id', team.user_id);
    const { error: authError } = await admin.auth.admin.deleteUser(team.user_id);
    if (authError) {
      console.error('DELETE AUTH USER ERROR:', authError.message);
      return badRequest('The team was removed, but its login could not be deleted. It may have history; deactivate it instead.', 500);
    }
  }

  await logAction(admin, auth.user.id, 'field_team.deleted', params.id, { name: team.name });
  return NextResponse.json({ ok: true });
}