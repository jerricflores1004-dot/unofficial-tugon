/**
 * Single data-access layer for the operations workspace.
 *
 * Every value rendered by the UI is fetched from the Next.js API routes, which
 * in turn query Supabase/PostgreSQL under row level security. There is no
 * sample-data branch anywhere in this file: when the database is unreachable
 * or unconfigured the call rejects and the view renders an error state.
 */

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to reach the database.';
}

export type Envelope<T> = { data: T; count?: number | null };

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const payload = await parse(response);
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error || `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

/** Reads the `{ data }` envelope produced by every GET route. */
export async function fetchEnvelope<T>(path: string): Promise<Envelope<T>> {
  return request<Envelope<T>>(path);
}

export async function fetchResource<T>(path: string): Promise<T> {
  const envelope = await fetchEnvelope<T>(path);
  return envelope.data;
}

export async function sendResource<T = unknown>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T | null> {
  const payload = await request<{ data?: T } | null>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return (payload?.data ?? null) as T | null;
}

export function buildQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
