import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, badRequest } from '@/lib/server-auth';
export async function POST(request: Request) { const auth = await requireRole(); if ('error' in auth) return auth.error; const parsed = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['android', 'ios', 'web']) }).safeParse(await request.json()); if (!parsed.success) return badRequest('Invalid device registration.'); const { error } = await auth.supabase.from('user_devices').upsert({ user_id: auth.user.id, fcm_token: parsed.data.token, platform: parsed.data.platform, last_seen_at: new Date().toISOString() }, { onConflict: 'fcm_token' }); if (error) return badRequest('Unable to register device.', 500); return NextResponse.json({ ok: true }); }
