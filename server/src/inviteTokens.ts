import crypto from 'crypto';

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

const tokens = new Map<string, InviteEntry>();

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
  return token;
}

/** Liest Einladungsdaten ohne das Token zu verbrauchen (für GET-Endpoint). */
export function getInviteEntry(token: string): InviteEntry | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokens.delete(token); return null; }
  return entry;
}

export type InviteAccessStatus = 'valid' | 'too_early' | 'expired' | 'not_found';

export function getInviteAccessStatus(token: string): InviteAccessStatus {
  const entry = tokens.get(token);
  if (!entry) return 'not_found';
  if (Date.now() > entry.expiresAt) { tokens.delete(token); return 'expired'; }
  if (entry.appointmentTime && Date.now() < entry.appointmentTime - EARLY_WINDOW_MS) return 'too_early';
  return 'valid';
}

/** Liest und verbraucht das Token (single-use, für WS-Verbindung). */
export function resolveInviteToken(token: string): InviteEntry | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokens.delete(token); return null; }
  tokens.delete(token); // single-use
  return entry;
}
