import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';
export async function GET() { const auth = await requireRole(['staff', 'admin', 'department_head']); if ('error' in auth) return auth.error; const { data, error } = await auth.supabase.from('responders').select('*, assigned_incidents:incidents(id,ticket_id,status)').order('name'); if (error) return badRequest('Unable to load responders.', 500); return NextResponse.json({ data }); }
