import { NextResponse } from 'next/server';
import { requireRole, badRequest } from '@/lib/server-auth';

const BUCKET = 'incident-photos';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('incident_photos').select('id, incident_id, original_name, content_type, size_bytes, storage_path, created_at').eq('incident_id', params.id).order('created_at', { ascending: true });
  if (error) return badRequest('Unable to load incident photos.', 500);
  const rows = data ?? [];
  const withUrls = await Promise.all(rows.map(async (row) => {
    const { data: signed } = await auth.supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
    return { ...row, signed_url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ data: withUrls });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['resident', 'staff']);
  if ('error' in auth) return auth.error;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('A photo file is required.');
  if (!file.type.startsWith('image/')) return badRequest('Only image files are accepted.');
  if (file.size > 8 * 1024 * 1024) return badRequest('Photo must be 8 MB or smaller.');

  // The photo ceiling is workspace configuration stored in the database.
  const { data: setting } = await auth.supabase.from('system_settings').select('value').eq('key', 'max_incident_photos').maybeSingle();
  const configured = Number(setting?.value);
  const maxPhotos = Number.isFinite(configured) && configured > 0 ? configured : 5;

  const { count } = await auth.supabase.from('incident_photos').select('id', { count: 'exact', head: true }).eq('incident_id', params.id);
  if ((count || 0) >= maxPhotos) return badRequest(`An incident can have up to ${maxPhotos} photos.`);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${params.id}/${crypto.randomUUID()}-${safeName}`;
  const upload = await auth.supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return badRequest('Unable to upload photo.', 500);
  const { data, error } = await auth.supabase.from('incident_photos').insert({
    incident_id: params.id, storage_path: upload.data.path, original_name: file.name,
    content_type: file.type, size_bytes: file.size, uploaded_by: auth.user.id,
  }).select('id, incident_id, original_name, content_type, size_bytes, storage_path, created_at').single();
  if (error) return badRequest('Unable to save photo metadata.', 500);
  return NextResponse.json({ data }, { status: 201 });
}
