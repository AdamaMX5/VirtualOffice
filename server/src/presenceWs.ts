/**
 * presenceWs – integrierter Presence-WebSocket-Server.
 *
 * Ersetzt den externen PresenceService vollständig.
 * Wird an den HTTP-Server angehängt (kein eigener Port).
 *
 * Eingehende Nachrichten (Client → Server):
 *   set_name      { name, department? }
 *   move          { x, y }
 *   refresh_token { token }
 *   notify_user   { targetUserId }   → sendet new_message an Ziel-User
 *   chat          { text }           → broadcastet an alle
 *
 * Ausgehende Nachrichten (Server → Client):
 *   snapshot    { users[] }
 *   user_joined { user_id, name, department?, x, y }
 *   user_moved  { user_id, x, y }
 *   user_left   { user_id }
 *   new_message { senderId }
 *   chat        { userId, text }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

interface UserInfo {
  ws:          WebSocket;
  user_id:     string;
  name:        string;
  department?: string;
  x:           number;
  y:           number;
}

const users = new Map<WebSocket, UserInfo>();
let guestCounter = 0;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: object, exclude?: WebSocket) {
  const json = JSON.stringify(msg);
  for (const ws of users.keys()) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

/** JWT-Payload ohne Signaturprüfung lesen (Vertrauen: AuthService hat Token bereits validiert). */
function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sub?: string };
  } catch {
    return null;
  }
}

function resolveUserId(token?: string | null): string {
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.sub) return payload.sub;
  }
  return `g_${++guestCounter}`;
}

// ── WS-Server ─────────────────────────────────────────────────────────────────

export function attachPresenceWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url    = new URL(req.url ?? '', 'http://x');
    const token  = url.searchParams.get('token');
    const userId = resolveUserId(token);

    const user: UserInfo = { ws, user_id: userId, name: userId, x: 60, y: 45 };
    users.set(ws, user);

    // Snapshot aller aktuellen User senden
    const snapshot = [...users.values()]
      .filter((u) => u.ws !== ws)
      .map(({ user_id, name, department, x, y }) => ({ user_id, name, department, x, y }));
    send(ws, { type: 'snapshot', users: snapshot });

    // Allen anderen: user_joined melden
    broadcast({
      type: 'user_joined',
      user_id: user.user_id,
      name:    user.name,
      x:       user.x,
      y:       user.y,
    }, ws);

    // ── Eingehende Nachrichten ─────────────────────────────────────────────
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        const u = users.get(ws);
        if (!u) return;

        switch (msg.type) {

          case 'set_name':
            u.name       = String(msg.name       ?? u.name);
            u.department = msg.department ? String(msg.department) : undefined;
            // Allen anderen: Updated-Join melden (damit Name in Snapshot korrekt ist)
            broadcast({
              type: 'user_joined',
              user_id:    u.user_id,
              name:       u.name,
              department: u.department,
              x:          u.x,
              y:          u.y,
            }, ws);
            break;

          case 'move':
            u.x = Number(msg.x ?? u.x);
            u.y = Number(msg.y ?? u.y);
            broadcast({ type: 'user_moved', user_id: u.user_id, x: u.x, y: u.y }, ws);
            break;

          case 'refresh_token':
            if (msg.token) {
              const payload = decodeJwtPayload(String(msg.token));
              if (payload?.sub) u.user_id = payload.sub;
            }
            break;

          case 'notify_user': {
            const targetId = String(msg.targetUserId ?? '');
            for (const tu of users.values()) {
              if (tu.user_id === targetId) {
                send(tu.ws, { type: 'new_message', senderId: u.user_id });
                break;
              }
            }
            break;
          }

          case 'chat': {
            const text = String(msg.text ?? '').slice(0, 500);
            if (text) broadcast({ type: 'chat', userId: u.user_id, text });
            break;
          }
        }
      } catch (err) {
        console.warn('[Presence] Ungültige Nachricht:', err);
      }
    });

    ws.on('close', () => {
      const u = users.get(ws);
      users.delete(ws);
      if (u) broadcast({ type: 'user_left', user_id: u.user_id });
    });

    ws.on('error', (err) => console.warn('[Presence] WS-Fehler:', err.message));
  });

  console.log('[Presence] WebSocket-Server aktiv auf /ws');
}

/** Gibt alle aktuell verbundenen User zurück (für den Reception-Bot). */
export function getConnectedUsers(): UserInfo[] {
  return [...users.values()];
}
