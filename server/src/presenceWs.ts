/**
 * presenceWs – integrierter Presence-WebSocket-Server mit Redis-Backend.
 *
 * Redis-Layout:
 *   vo:{room}:events          → Pub/Sub-Channel für alle Presence-Events
 *   vo:{room}:users:{userId}  → Hash { name, department, x, y }, TTL 120 s
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
import { redisPub, redisSub } from './redis';

// ── Konstanten ────────────────────────────────────────────────────────────────

const ROOM     = 'main';
const CHANNEL  = `vo:${ROOM}:events`;
const userKey  = (id: string) => `vo:${ROOM}:users:${id}`;
const USER_TTL = 120; // Sekunden — wird bei jedem move/set_name erneuert

// ── Typen ─────────────────────────────────────────────────────────────────────

interface UserInfo {
  ws:          WebSocket;
  user_id:     string;
  name:        string;
  department?: string;
  x:           number;
  y:           number;
}

// Nur lokale WS-Verbindungen dieser Instanz
const connections = new Map<WebSocket, UserInfo>();
let guestCounter = 0;

// ── Redis-Helpers ─────────────────────────────────────────────────────────────

async function saveUserState(u: UserInfo): Promise<void> {
  const key = userKey(u.user_id);
  await redisPub.hset(key, {
    name:       u.name,
    department: u.department ?? '',
    x:          u.x,
    y:          u.y,
  });
  await redisPub.expire(key, USER_TTL);
}

async function removeUserState(userId: string): Promise<void> {
  await redisPub.del(userKey(userId));
}

/** Liest alle User-Snapshots aus Redis (inkl. User auf anderen Instanzen). */
async function getSnapshot(excludeId?: string): Promise<Array<{
  user_id: string; name: string; department?: string; x: number; y: number;
}>> {
  const prefix = `vo:${ROOM}:users:`;
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redisPub.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  const result = [];
  for (const key of keys) {
    const userId = key.slice(prefix.length);
    if (userId === excludeId) continue;
    const d = await redisPub.hgetall(key);
    if (!d?.name) continue;
    result.push({
      user_id:    userId,
      name:       d.name,
      department: d.department || undefined,
      x:          Number(d.x ?? 60),
      y:          Number(d.y ?? 45),
    });
  }
  return result;
}

async function publishEvent(event: object): Promise<void> {
  await redisPub.publish(CHANNEL, JSON.stringify(event));
}

// ── WS-Helpers ────────────────────────────────────────────────────────────────

function sendTo(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastLocal(msg: object, excludeUserId?: string): void {
  const json = JSON.stringify(msg);
  for (const [ws, u] of connections) {
    if (excludeUserId && u.user_id === excludeUserId) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sub?: string };
  } catch {
    return null;
  }
}

function resolveUserId(token?: string | null, botId?: string | null, isLocalhost = false): string {
  if (isLocalhost && botId) return botId;
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.sub) return payload.sub;
  }
  return `g_${++guestCounter}`;
}

// ── Redis-Subscriber ──────────────────────────────────────────────────────────
// Alle Instanzen empfangen jeden Event und senden ihn an ihre lokalen WS-Clients.

redisSub.subscribe(CHANNEL, (err) => {
  if (err) console.error('[Presence] Redis-Subscribe Fehler:', err.message);
  else     console.log(`[Presence] Subscribed auf ${CHANNEL}`);
});

redisSub.on('message', (_ch: string, raw: string) => {
  try {
    const event = JSON.parse(raw) as Record<string, unknown>;

    if (event.type === 'notify_user') {
      // Gezielt: nur der Ziel-User auf dieser Instanz bekommt die Nachricht
      const targetId = String(event.targetUserId ?? '');
      for (const u of connections.values()) {
        if (u.user_id === targetId) {
          sendTo(u.ws, { type: 'new_message', senderId: event.senderId });
          break;
        }
      }
      return;
    }

    // Alle anderen Events → Broadcast an lokale WS-Clients.
    // user_id im Event = Absender → nicht zurückschicken (kein Echo).
    const excludeId = typeof event.user_id === 'string' ? event.user_id : undefined;
    broadcastLocal(event, excludeId);
  } catch (err) {
    console.warn('[Presence] Ungültiges Redis-Event:', err);
  }
});

// ── WS-Server ─────────────────────────────────────────────────────────────────

export function attachPresenceWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url    = new URL(req.url ?? '', 'http://x');
    const token  = url.searchParams.get('token');
    const botId  = url.searchParams.get('bot_id');
    const remote = req.socket.remoteAddress ?? '';
    const isLocal = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    const userId = resolveUserId(token, botId, isLocal);

    const user: UserInfo = { ws, user_id: userId, name: userId, x: 60, y: 45 };
    connections.set(ws, user);

    // Snapshot aus Redis — enthält auch User von anderen Server-Instanzen
    const snapshot = await getSnapshot(userId);
    sendTo(ws, { type: 'snapshot', users: snapshot });

    // User in Redis registrieren und allen anderen melden
    await saveUserState(user);
    await publishEvent({
      type: 'user_joined',
      user_id: user.user_id,
      name:    user.name,
      x:       user.x,
      y:       user.y,
    });

    // ── Eingehende Nachrichten ─────────────────────────────────────────────
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        const u = connections.get(ws);
        if (!u) return;

        switch (msg.type) {

          case 'set_name':
            u.name       = String(msg.name       ?? u.name);
            u.department = msg.department ? String(msg.department) : undefined;
            await saveUserState(u);
            await publishEvent({
              type:       'user_joined', // überschreibt alten Eintrag im Client-State
              user_id:    u.user_id,
              name:       u.name,
              department: u.department,
              x:          u.x,
              y:          u.y,
            });
            break;

          case 'move':
            u.x = Number(msg.x ?? u.x);
            u.y = Number(msg.y ?? u.y);
            await saveUserState(u);
            await publishEvent({ type: 'user_moved', user_id: u.user_id, x: u.x, y: u.y });
            break;

          case 'refresh_token':
            if (msg.token) {
              const payload = decodeJwtPayload(String(msg.token));
              if (payload?.sub) u.user_id = payload.sub;
            }
            break;

          case 'notify_user': {
            const targetId = String(msg.targetUserId ?? '');
            await publishEvent({ type: 'notify_user', targetUserId: targetId, senderId: u.user_id });
            break;
          }

          case 'chat': {
            const text = String(msg.text ?? '').slice(0, 500);
            if (text) await publishEvent({ type: 'chat', userId: u.user_id, text });
            break;
          }
        }
      } catch (err) {
        console.warn('[Presence] Ungültige Nachricht:', err);
      }
    });

    ws.on('close', async () => {
      const u = connections.get(ws);
      connections.delete(ws);
      if (u) {
        await removeUserState(u.user_id);
        await publishEvent({ type: 'user_left', user_id: u.user_id });
      }
    });

    ws.on('error', (err) => console.warn('[Presence] WS-Fehler:', err.message));
  });

  console.log('[Presence] WebSocket-Server aktiv auf /ws');
}

/** Gibt alle lokal verbundenen User zurück (für den Reception-Bot). */
export function getConnectedUsers(): UserInfo[] {
  return [...connections.values()];
}
