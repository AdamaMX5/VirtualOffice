/**
 * inviteTokens – Einladungs-Token im ObjectService speichern und abfragen.
 *
 * Der ObjectService ist die einzige Quelle der Wahrheit (kein lokaler Datei-Speicher).
 * Ein kurzer In-Memory-Cache (5 Minuten TTL) verhindert unnötige HTTP-Anfragen
 * beim wiederholten Lesen desselben Tokens (z.B. GET-Endpoint + WS-Connect).
 *
 * ObjectService-Collection: 'invitations'
 *   data:  { token, inviterId, inviterName, guestName, roomId, appointmentTime, expiresAt, createdAt }
 *   refs:  { token, inviterId }   ← ref[token]-Suche nutzt den Wildcard-Index
 *   isPublic: true                ← Token ist die Auth-Barriere (128-Bit-Zufallswert)
 */

import crypto from 'crypto';
import { config } from './config';

export interface InviteEntry {
  inviterId:        string;
  inviterName:      string;
  guestName:        string;
  roomId?:          string;
  appointmentTime?: number;  // Unix-ms; optional
  expiresAt:        number;
}

// Mittelpunkte der Räume (Tile-Koordinaten) für Startposition
export const ROOM_STARTS: Record<string, { x: number; y: number }> = {
  'Eingangshalle': { x: 60, y: 55 },
  'Flur':          { x: 60, y: 65 },
  'Büro A':        { x: 41, y: 51 },
  'Büro B':        { x: 79, y: 51 },
  'Meetingraum':   { x: 60, y: 74 },
  'Serverraum':    { x: 95, y: 53 },
};

const EARLY_WINDOW_MS = 15 * 60 * 1000;
const COLLECTION      = 'invitations';

// ── In-Memory-Cache (5 Minuten TTL) ──────────────────────────────────────────

interface CacheEntry {
  entry:    InviteEntry;
  cachedAt: number;
}

const cache     = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(token: string): InviteEntry | null {
  const c = cache.get(token);
  if (!c) return null;
  if (Date.now() - c.cachedAt > CACHE_TTL) { cache.delete(token); return null; }
  return c.entry;
}

// ── ObjectService-Abfrage ─────────────────────────────────────────────────────

type ObjDoc = { _id: string; data: Record<string, unknown> };

function parseList(body: unknown): ObjDoc[] {
  if (Array.isArray(body)) return body as ObjDoc[];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.objects)) return b.objects as ObjDoc[];
  if (Array.isArray(b.items))   return b.items   as ObjDoc[];
  if (Array.isArray(b.data))    return b.data    as ObjDoc[];
  return [];
}

function docToEntry(d: Record<string, unknown>): InviteEntry {
  return {
    inviterId:       String(d.inviterId       ?? ''),
    inviterName:     String(d.inviterName     ?? ''),
    guestName:       String(d.guestName       ?? 'Gast'),
    roomId:          d.roomId          ? String(d.roomId)          : undefined,
    appointmentTime: d.appointmentTime ? Number(d.appointmentTime) : undefined,
    expiresAt:       Number(d.expiresAt       ?? 0),
  };
}

/** Sucht ein Token im ObjectService (isPublic=true, kein Auth nötig). */
async function fetchFromStore(token: string): Promise<InviteEntry | null> {
  try {
    const url = `${config.OBJECT_URL}/objects/${COLLECTION}?ref[token]=${encodeURIComponent(token)}&app=VirtualOffice`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const docs = parseList(await res.json());
    if (docs.length === 0) return null;
    const entry = docToEntry(docs[0].data);
    cache.set(token, { entry, cachedAt: Date.now() });
    return entry;
  } catch (err) {
    console.warn('[Invite] ObjectService-Abfrage fehlgeschlagen:', (err as Error).message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Erstellt einen Einladungs-Token und speichert ihn im ObjectService.
 * jwt: Bearer-Token des einladenden Nutzers (für die POST-Anfrage).
 */
export async function createInviteToken(
  inviterId:        string,
  inviterName:      string,
  guestName:        string,
  roomId?:          string,
  appointmentTime?: number,
  jwt?:             string,
): Promise<string> {
  const token     = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 h
  const data = {
    token,
    inviterId,
    inviterName,
    guestName,
    roomId:          roomId          ?? null,
    appointmentTime: appointmentTime ?? null,
    expiresAt,
    createdAt: Date.now(),
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  const res = await fetch(`${config.OBJECT_URL}/objects/${COLLECTION}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data,
      refs:     { token, inviterId },
      isPublic: true,
      app:      'VirtualOffice',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(err.error ?? err.detail ?? 'Einladung speichern fehlgeschlagen'));
  }
  const doc = await res.json() as { _id: string };
  console.log(`[Invite] Token gespeichert (ObjectService) docId=${doc._id}`);

  // Direkt in Cache schreiben — spart sofortigen Re-Fetch
  const entry: InviteEntry = { inviterId, inviterName, guestName, roomId, appointmentTime, expiresAt };
  cache.set(token, { entry, cachedAt: Date.now() });
  return token;
}

/** Liest Einladungsdaten ohne Verbrauch (für GET /api/invite/:token). */
export async function getInviteEntry(token: string): Promise<InviteEntry | null> {
  const entry = cacheGet(token) ?? await fetchFromStore(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

export type InviteAccessStatus = 'valid' | 'too_early' | 'expired' | 'not_found';

export async function getInviteAccessStatus(token: string): Promise<InviteAccessStatus> {
  const entry = cacheGet(token) ?? await fetchFromStore(token);
  if (!entry) return 'not_found';
  if (Date.now() > entry.expiresAt) return 'expired';
  if (entry.appointmentTime && Date.now() < entry.appointmentTime - EARLY_WINDOW_MS) return 'too_early';
  return 'valid';
}

/**
 * Liest das Token für den WS-Verbindungsaufbau.
 * Token bleibt im ObjectService bestehen — Gast kann die Seite neu laden.
 */
export async function resolveInviteToken(token: string): Promise<InviteEntry | null> {
  const entry = cacheGet(token) ?? await fetchFromStore(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}
