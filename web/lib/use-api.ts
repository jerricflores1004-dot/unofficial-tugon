'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, fetchEnvelope, fetchResource } from './api-client';

export type ResourceState<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };
export type PagedState<T> = { rows: T[]; count: number; loading: boolean; error: string | null; reload: () => void };
export type GroupState<T> = {
  data: { [K in keyof T]: T[K] | null };
  loading: boolean;
  errors: { [K in keyof T]?: string };
  reload: () => void;
};

function useReload() {
  const [nonce, setNonce] = useState(0);
  return { nonce, reload: useCallback(() => setNonce((value) => value + 1), []) };
}

/** Fetches one `{ data }` resource. Pass `null` as the path to disable the call. */
export function useApi<T>(path: string | null, deps: (string | number | boolean)[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const { nonce, reload } = useReload();
  const key = deps.join('|');
  useEffect(() => {
    if (!path) { setData(null); setLoading(false); setError(null); return; }
    let active = true;
    setLoading(true);
    setError(null);
    fetchResource<T>(path)
      .then((result) => { if (active) { setData(result); setLoading(false); } })
      .catch((cause: unknown) => { if (active) { setData(null); setError(describeError(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [path, key, nonce]);
  return { data, loading, error, reload };
}

/** Fetches a paginated list route that returns `{ data, count }`. */
export function usePagedApi<T>(path: string | null, deps: (string | number | boolean)[] = []): PagedState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const { nonce, reload } = useReload();
  const key = deps.join('|');
  useEffect(() => {
    if (!path) { setRows([]); setCount(0); setLoading(false); setError(null); return; }
    let active = true;
    setLoading(true);
    setError(null);
    fetchEnvelope<T[]>(path)
      .then((envelope) => {
        if (!active) return;
        const list = Array.isArray(envelope.data) ? envelope.data : [];
        setRows(list);
        setCount(typeof envelope.count === 'number' ? envelope.count : list.length);
        setLoading(false);
      })
      .catch((cause: unknown) => { if (active) { setRows([]); setCount(0); setError(describeError(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [path, key, nonce]);
  return { rows, count, loading, error, reload };
}

/** Fetches several `{ data }` resources in parallel and reports per-key errors. */
export function useApiGroup<T extends Record<string, unknown>>(paths: { [K in keyof T]: string | null }): GroupState<T> {
  const [data, setData] = useState<{ [K in keyof T]: T[K] | null }>(() => Object.keys(paths).reduce((accumulator, key) => {
    accumulator[key as keyof T] = null;
    return accumulator;
  }, {} as { [K in keyof T]: T[K] | null }));
  const [errors, setErrors] = useState<{ [K in keyof T]?: string }>({});
  const [loading, setLoading] = useState(Object.values(paths).some(Boolean));
  const { nonce, reload } = useReload();
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const key = JSON.stringify(paths);
  useEffect(() => {
    const entries = Object.entries(pathsRef.current) as [keyof T & string, string | null][];
    const requested = entries.filter(([, path]) => Boolean(path));
    if (requested.length === 0) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all(requested.map(async ([resourceKey, path]) => {
      try {
        const value = await fetchResource<T[keyof T]>(path as string);
        return [resourceKey, value, null] as const;
      } catch (cause) {
        return [resourceKey, null, describeError(cause)] as const;
      }
    })).then((results) => {
      if (!active) return;
      const nextData = { ...pathsRef.current } as unknown as { [K in keyof T]: T[K] | null };
      Object.keys(nextData).forEach((resourceKey) => { nextData[resourceKey as keyof T] = null; });
      const nextErrors: { [K in keyof T]?: string } = {};
      results.forEach(([resourceKey, value, failure]) => {
        nextData[resourceKey as keyof T] = value as T[keyof T] | null;
        if (failure) nextErrors[resourceKey as keyof T] = failure;
      });
      setData(nextData);
      setErrors(nextErrors);
      setLoading(false);
    });
    return () => { active = false; };
  }, [key, nonce]);
  return { data, loading, errors, reload };
}
