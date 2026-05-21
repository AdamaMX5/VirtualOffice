/**
 * objectClient (Server-seitig) – schlankes Äquivalent zu client/src/services/objectClient.ts
 * für den Einsatz im Express-Server (kein React, keine Browser-APIs).
 *
 * JWT wird explizit als Parameter übergeben — kein Auth-Store, kein Token-Refresh.
 * Reads ohne JWT funktionieren für isPublic=true Dokumente.
 */

import { config } from './config';

export interface ObjectDoc {
  _id: string;
  data: Record<string, unknown>;
  refs?: Record<string, string>;
  app?: string;
  isPublic?: boolean;
}

// ── Interner Helper ───────────────────────────────────────────────────────────

async function objFetch<T>(
  path: string,
  options: RequestInit = {},
  jwt?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const res = await fetch(`${config.OBJECT_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? data.detail ?? 'ObjectService-Fehler'));
  return data as T;
}

function parseList(raw: unknown): ObjectDoc[] {
  if (Array.isArray(raw)) return raw as ObjectDoc[];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.objects)) return r.objects as ObjectDoc[];
  if (Array.isArray(r.items))   return r.items   as ObjectDoc[];
  if (Array.isArray(r.data))    return r.data    as ObjectDoc[];
  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listObjects(
  collection: string,
  params?: Record<string, string>,
  jwt?: string | null,
): Promise<ObjectDoc[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const result = await objFetch<unknown>(`/objects/${collection}${qs}`, {}, jwt);
  return parseList(result);
}

export async function createObject(
  collection: string,
  data: Record<string, unknown>,
  refs?: Record<string, string>,
  jwt?: string | null,
  app = 'VirtualOffice',
  isPublic = false,
): Promise<ObjectDoc> {
  return objFetch<ObjectDoc>(`/objects/${collection}`, {
    method: 'POST',
    body: JSON.stringify({ data, refs, app, isPublic }),
  }, jwt);
}

export async function deleteObject(
  collection: string,
  id: string,
  jwt?: string | null,
): Promise<void> {
  await objFetch<unknown>(`/objects/${collection}/${id}`, { method: 'DELETE' }, jwt);
}
