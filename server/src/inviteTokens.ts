import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

const EARLY_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten Vorlaufzeit

// ── Datei-Persistenz ──────────────────────────────────────────────────────────

const DATA_DIR    = path.join(__dirname, '..', 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'invite-tokens.json');

function persist(map: Map<string, InviteEntry>): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(Object.fromEntries(map), null, 2), 'utf8');
  } catch (e) {
    console.warn('[Invite] Persistenz fehlgeschlagen:', e);
  }
}

function loadFromDisk(): Map<string, InviteEntry> {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    const obj = JSON.parse(raw) as Record<string, InviteEntry>;
    const now = Date.now();
    const map = new Map<string, InviteEntry>();
    for (const [token, entry] of Object.entries(obj)) {
      if (now <= entry.expiresAt) map.set(token, entry); // abgelaufene Token verwerfen
    }
    if (map.size > 0) console.log(`[Invite] ${map.size} Token(s) aus Datei geladen`);
    return map;
  } catch {
    return new Map();
  }
}

const tokens = loadFromDisk();

// ── Public API ────────────────────────────────────────────────────────────────

export function createInviteToken(
  inviterId: string,
  inviterName: string,
  guestName: string,
  roomId?: string,
  appointmentTime?: number,
): string {
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, {
    inviterId,
    inviterName,
    guestName,
    roomId,
    appointmentTime,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  });
  persist(tokens);
  return token;
}

/** Liest Einladungsdaten ohne das Token zu verbrauchen (für GET-Endpoint). */
export function getInviteEntry(token: string): InviteEntry | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokens.delete(token); persist(tokens); return null; }
  return entry;
}

export type InviteAccessStatus = 'valid' | 'too_early' | 'expired' | 'not_found';

export function getInviteAccessStatus(token: string): InviteAccessStatus {
  const entry = tokens.get(token);
  if (!entry) return 'not_found';
  if (Date.now() > entry.expiresAt) { tokens.delete(token); persist(tokens); return 'expired'; }
  if (entry.appointmentTime && Date.now() < entry.appointmentTime - EARLY_WINDOW_MS) return 'too_early';
  return 'valid';
}

/** Liest und verbraucht das Token (single-use, für WS-Verbindung). */
export function resolveInviteToken(token: string): InviteEntry | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokens.delete(token); persist(tokens); return null; }
  tokens.delete(token); // single-use
  persist(tokens);
  return entry;
}
