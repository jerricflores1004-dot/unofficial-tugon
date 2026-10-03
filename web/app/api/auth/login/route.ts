import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';
const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
export async function POST(request: Request) { const body = schema.safeParse(await request.json()); if (!body.success) return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 400 }); const supabase = await createServerSupabase(); if (!supabase) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 }); const { data, error } = await supabase.auth.signInWithPassword(body.data); if (error) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 }); return NextResponse.json({ user: data.user, session: data.session }); }
