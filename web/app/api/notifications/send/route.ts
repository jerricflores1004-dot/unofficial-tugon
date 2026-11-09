import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  recipientId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(1000),
  type: z.enum(['report_confirmation', 'status_update', 'emergency_alert', 'announcement']),
});

export async function POST(request: Request) {
  const auth = await requireRole(['admin']);
  if ('error' in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid notification.');

  const admin = createAdminClient();
  if (!admin) return badRequest('The database connection is not configured.', 503);

  const { data, error } = await admin
    .from('notifications')
    .insert({
      user_id: parsed.data.recipientId ?? null,
      sender_id: auth.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      notification_type: parsed.data.type,
    })
    .select()
    .single();
  if (error) return badRequest('Unable to queue notification.', 500);

  // Push delivery is done by the database webhook calling /api/push.
  return NextResponse.json(
    { data, delivery: { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), sent: 0 } },
    { status: 201 },
  );
}