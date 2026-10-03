import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';
export async function GET() { const auth = await requireRole(); if ('error' in auth) return auth.error; const { data, error } = await auth.supabase.from('notifications').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(100); if (error) return badRequest('Unable to load notifications.', 500); return NextResponse.json({ data }); }
