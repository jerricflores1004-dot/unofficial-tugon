import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireRole } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { generatePassword, loadFieldTeams, logAction } from '@/lib/field-teams-server';

export async function GET() {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  try {
    return NextResponse.json({ data: await loadFieldTeams(admin) });
  } catch (cause) {
    console.error('FIELD TEAMS LOAD ERROR:', cause);
    return badRequest('Unable to load field teams.', 500);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(160),
  contactNumber: z.string().trim().min(7).max(40).optional(),
  members: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

// "Team Alpha" or "alpha" fills the team enum. Any other name leaves it empty.
function enumTeam(name: string): 'alpha' | 'bravo' | 'charlie' | null {
  const match = name.toLowerCase().trim().match(/^(?:team\s+)?(alpha|bravo|charlie)$/);
  return (match?.[1] as 'alpha' | 'bravo' | 'charlie') ?? null;
}

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Enter a team name and a valid login email.');
  const { name, email, contactNumber, members } = parsed.data;
  const team = enumTeam(name);

  // Team names must be unique (ignoring upper/lower case).
  const { data: existing } = await admin.from('field_teams').select('name');
  if ((existing ?? []).some((row: { name: string }) => row.name.trim().toLowerCase() === name.toLowerCase())) {
    return badRequest(`A team named "${name}" already exists.`, 409);
  }

  // 1. Login account
  const password = generatePassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { account_type: 'mdrrmo_field', team },
    user_metadata: { full_name: name },
  });
  if (createError || !created?.user) {
    console.error('CREATE AUTH USER ERROR:', createError?.message);
    const duplicate = createError?.message?.toLowerCase().includes('already');
    return badRequest(duplicate ? 'That email is already registered.' : 'Unable to create the login account.', duplicate ? 409 : 500);
  }
  const userId = created.user.id;

  async function rollback() {
    await admin!.from('field_teams').delete().eq('user_id', userId);
    await admin!.from('users').delete().eq('id', userId);
    await admin!.auth.admin.deleteUser(userId);
  }

  // 2. Application profile (upsert in case a trigger already created a row)
  const { error: profileError } = await admin.from('users').upsert(
    {
      id: userId,
      email,
      full_name: name,
      phone: contactNumber ?? null,
      role: 'staff',
      agency: 'mdrrmo',
      team,
      is_active: true,
    },
    { onConflict: 'id' }
  );
  if (profileError) {
    console.error('CREATE PROFILE ERROR:', profileError);
    await rollback();
    return badRequest('Unable to create the team profile.', 500);
  }

  // 3. Field team row
  const { data: row, error: teamError } = await admin
    .from('field_teams')
    .insert({
      user_id: userId,
      name,
      contact_number: contactNumber ?? null,
      members,
      status: 'offline',
      is_active: true,
    })
    .select('id')
    .single();
  if (teamError || !row) {
    console.error('CREATE FIELD TEAM ERROR:', teamError);
    await rollback();
    return badRequest('Unable to create the field team.', 500);
  }

  await logAction(admin, auth.user.id, 'field_team.created', row.id, { name, email });

  const [dto] = await loadFieldTeams(admin, row.id);
  return NextResponse.json({ data: { team: dto, tempPassword: password } }, { status: 201 });
}