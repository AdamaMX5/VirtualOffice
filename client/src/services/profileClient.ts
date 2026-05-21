import { OBJECT_URL } from '../model/constants';
import { getFreshJwt } from './authClient';
import { getJwtUserId } from './objectClient';

const COLLECTION = 'user_profiles';

export interface UserProfile {
  firstName: string;
  lastName: string;
  department: string;
  title: string;       // Berufsbezeichnung / Stellenbezeichnung
  email: string;       // E-Mail-Adresse (aus authStore beim Speichern befüllt)
  avatarUrl: string;
  calendarUrl: string;
}

interface ProfileDoc {
  _id: string;
  data: UserProfile;
}

async function authHeaders(): Promise<Record<string, string>> {
  const jwt = await getFreshJwt().catch(() => null);
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

function parseDocList(raw: unknown): ProfileDoc[] {
  if (Array.isArray(raw)) return raw as ProfileDoc[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.objects)) return r.objects as ProfileDoc[];
    if (Array.isArray(r.items))   return r.items   as ProfileDoc[];
    if (Array.isArray(r.data))    return r.data    as ProfileDoc[];
  }
  return [];
}

export async function loadProfile(userId: string): Promise<{ id: string; profile: UserProfile } | null> {
  try {
    const headers = await authHeaders();
    const url = `${OBJECT_URL}/objects/${COLLECTION}?ref[userId]=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const docs = parseDocList(await res.json());
    if (docs.length === 0) return null;
    return { id: docs[0]._id, profile: docs[0].data };
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const userId = getJwtUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const body = JSON.stringify({ data: profile, refs: { userId }, app: 'VirtualOffice', isPublic: true });

  const existing = await loadProfile(userId);
  const res = existing
    ? await fetch(`${OBJECT_URL}/objects/${COLLECTION}/${existing.id}`, { method: 'PUT', headers, body })
    : await fetch(`${OBJECT_URL}/objects/${COLLECTION}`,               { method: 'POST', headers, body });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(err.error ?? err.detail ?? 'Profil-Speichern fehlgeschlagen'));
  }
}
