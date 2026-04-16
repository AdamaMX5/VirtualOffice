import { useAuthStore } from '../model/stores/authStore';
import { OBJECT_URL, MEDIA_URL } from '../model/constants';

// ── JWT helpers ───────────────────────────────────────────────────────────────

/** JWT aus dem Store – nie werfen, damit Requests auch ohne Login abgehen. */
function getJwt(): string | null {
  return useAuthStore.getState().jwt;
}

/** Liest die User-ID (sub-Claim) aus dem JWT, ohne Signaturprüfung. */
export function getJwtUserId(): string {
  try {
    const jwt = useAuthStore.getState().jwt;
    if (!jwt) return '';
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.sub ?? payload.userId ?? payload.id ?? '');
  } catch {
    return '';
  }
}

// ── ObjectService ─────────────────────────────────────────────────────────────

export interface ObjectDoc {
  _id: string;
  data: Record<string, unknown>;
  refs?: Record<string, string>;
  app?: string;
  isPublic?: boolean;
}

/** Fetch mit optionalem JWT — für Reads genügt es wenn vorhanden, für Writes ist es Pflicht. */
async function objFetch<T>(path: string, options: RequestInit = {}, jwt?: string | null): Promise<T> {
  const authHeaders: Record<string, string> = jwt ? { Authorization: `Bearer ${jwt}` } : {};
  const res = await fetch(`${OBJECT_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? data.detail ?? 'ObjectService-Fehler'));
  return data as T;
}

/** Liest Objekte — funktioniert auch ohne JWT (public reads). */
export async function listObjects(
  collection: string,
  params?: Record<string, string>,
): Promise<ObjectDoc[]> {
  const jwt = useAuthStore.getState().jwt; // optional
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const result = await objFetch<unknown>(`/objects/${collection}${qs}`, {}, jwt);
  if (Array.isArray(result)) return result as ObjectDoc[];
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.items)) return r.items as ObjectDoc[];
  if (Array.isArray(r.data))  return r.data  as ObjectDoc[];
  return [];
}

export async function createObject(
  collection: string,
  data: Record<string, unknown>,
  refs?: Record<string, string>,
  app = 'VirtualOffice',
  isPublic = true,
): Promise<ObjectDoc> {
  const jwt = getJwt();
  return objFetch<ObjectDoc>(`/objects/${collection}`, {
    method: 'POST',
    body: JSON.stringify({ data, refs, app, isPublic }),
  }, jwt);
}

export async function patchObject(
  collection: string,
  id: string,
  data?: Record<string, unknown>,
  refs?: Record<string, string>,
): Promise<ObjectDoc> {
  const jwt = getJwt();
  return objFetch<ObjectDoc>(`/objects/${collection}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data, refs, merge: true }),
  }, jwt);
}

export async function deleteObject(collection: string, id: string): Promise<void> {
  const jwt = getJwt();
  await objFetch<unknown>(`/objects/${collection}/${id}`, { method: 'DELETE' }, jwt);
}

// ── MediaService ──────────────────────────────────────────────────────────────

export async function uploadMedia(
  file: File,
  appName = 'VirtualOffice',
  folder?: string,
  name?: string,
  description?: string,
): Promise<{ url: string; id: string }> {
  const jwt = getJwt();
  const form = new FormData();
  form.append('file', file);
  form.append('app_name', appName);
  if (folder)      form.append('folder', folder);
  if (name)        form.append('name', name);
  if (description) form.append('description', description);

  const headers: Record<string, string> = {};
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  const res = await fetch(`${MEDIA_URL}/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? data.detail ?? 'Upload fehlgeschlagen'));
  return {
    url: String(data.url ?? ''),
    id:  String(data._id ?? data.id ?? ''),
  };
}
