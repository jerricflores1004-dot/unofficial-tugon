import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function secretMatches(received: string | null) {
  const expected = process.env.PUSH_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function getFcm() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getMessaging();
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('x-webhook-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const record = payload?.record as {
    id?: string; user_id?: string | null; title?: string; body?: string; notification_type?: string;
  } | undefined;
  if (!record?.id || !record.user_id) return NextResponse.json({ ok: true, skipped: 'no recipient' });

  const fcm = getFcm();
  const admin = createAdminClient();
  if (!fcm || !admin) return NextResponse.json({ error: 'Push is not configured.' }, { status: 503 });

  const { data: devices } = await admin.from('user_devices').select('fcm_token').eq('user_id', record.user_id);
  const tokens = (devices ?? []).map((device: { fcm_token: string }) => device.fcm_token);
  if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const result = await fcm.sendEachForMulticast({
    tokens,
    notification: { title: record.title ?? 'TUGON', body: record.body ?? '' },
    data: { notification_id: record.id, notification_type: record.notification_type ?? '' },
    android: { priority: 'high' },
  });

  // Remove tokens that no longer belong to an installed app.
  const dead = tokens.filter((_, index) => {
    const response = result.responses[index];
    const code = response.error?.code ?? '';
    return !response.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token');
  });
  if (dead.length > 0) await admin.from('user_devices').delete().in('fcm_token', dead);

  return NextResponse.json({ ok: true, sent: result.successCount, failed: result.failureCount });
}