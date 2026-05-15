import crypto from 'crypto';

interface InviteEntry {
  inviterId:   string;
  inviterName: string;
  expiresAt:   number;
}

const tokens = new Map<string, InviteEntry>();

export function createInviteToken(inviterId: string, inviterName: string): string {
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, {
    inviterId,
    inviterName,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  });
  return token;
}

export function resolveInviteToken(token: string): { inviterId: string; inviterName: string } | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokens.delete(token); return null; }
  tokens.delete(token); // single-use
  return { inviterId: entry.inviterId, inviterName: entry.inviterName };
}
