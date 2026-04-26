/**
 * presenceWs – integrierter Presence-WebSocket-Server mit Redis-Backend.
 *
 * Fällt bei Redis-Ausfall automatisch auf lokalen In-Memory-Betrieb zurück.
 *
 * Redis-Layout:
 *   vo:{room}:events          → Pub/Sub-Channel für alle Presence-Events
 *   vo:{room}:users:{userId}  → Hash { name, department, x, y }, TTL 120 s
 *
 * Eingehende Nachrichten (Client → Server):
 *   set_name      { name, department? }
 *   move          { x, y }
 *   refresh_token { token }
 *   notify_user   { targetUserId }
 *   chat          { text }
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

const ROOM        = 'main';
const CHANNEL     = `vo:${ROOM}:events`;
const userKey     = (id: string) => `vo:${ROOM}:users:${id}`;
const lastPosKey  = (id: string) => `vo:${ROOM}:lastpos:${id}`;
const USER_TTL    = 3600;     // 1 Stunde — Sitzungs-Key
const LASTPOS_TTL = 604_800;  // 7 Tage — letzte Position bleibt erhalten

// ── In-Memory Fallback für letzte Positionen (wenn Redis offline) ─────────────

const _lastPosCache = new Map<string, { x: number; y: number }>();

// ── Typen ─────────────────────────────────────────────────────────────────────

interface UserInfo {
  ws:          WebSocket;
  user_id:     string;
  name:        string;
  department?: string;
  x:           number;
  y:           number;
}

const connections = new Map<WebSocket, UserInfo>();
let guestCounter = 0;

// ── Redis-Verfügbarkeit ───────────────────────────────────────────────────────

let redisReady = false;

redisPub.on('ready', async () => {
  redisReady = true;
  console.log('[Presence] Redis bereit — Multi-Instanz-Modus aktiv');
  // Bestehende In-Memory-Verbindungen nachträglich in Redis eintragen
  const existing = [...connections.values()];
  if (existing.length > 0) {
    console.log(`[Presence] Synchronisiere ${existing.length} bestehende Verbindung(en) nach Redis`);
    await Promise.allSettled(existing.map((u) => saveUserState(u)));
  }
});
redisPub.on('close', () => { redisReady = false; console.warn('[Presence] Redis getrennt — Fallback auf lokalen Betrieb'); });
redisPub.on('error', () => { redisReady = false; }); // Fehlermeldung kommt schon aus redis.ts

// ── Redis-Helpers (mit Fallback) ──────────────────────────────────────────────

async function saveUserState(u: UserInfo): Promise<void> {
  if (!redisReady) return;
  try {
    await redisPub.hset(userKey(u.user_id), {
      name:       u.name,
      department: u.department ?? '',
      x:          u.x,
      y:          u.y,
    });
    await redisPub.expire(userKey(u.user_id), USER_TTL);
  } catch (err) {
    console.warn('[Presence] saveUserState fehlgeschlagen:', (err as Error).message);
  }
}

async function saveLastPos(userId: string, x: number, y: number): Promise<void> {
  _lastPosCache.set(userId, { x, y }); // immer lokal cachen als Fallback
  if (!redisReady) return;
  try {
    await redisPub.hset(lastPosKey(userId), { x, y });
    await redisPub.expire(lastPosKey(userId), LASTPOS_TTL);
  } catch { /* ignoriert */ }
}

async function loadLastPos(userId: string): Promise<{ x: number; y: number }> {
  if (redisReady) {
    try {
      const d = await redisPub.hgetall(lastPosKey(userId));
      if (d?.x && d?.y) return { x: Number(d.x), y: Number(d.y) };
    } catch { /* ignoriert */ }
  }
  return _lastPosCache.get(userId) ?? { x: 60, y: 45 };
}

async function removeUserState(userId: string): Promise<void> {
  if (!redisReady) return;
  try {
    await redisPub.del(userKey(userId));
  } catch (err) {
    console.warn('[Presence] removeUserState fehlgeschlagen:', (err as Error).message);
  }
}

/** Snapshot: Redis-Daten + lokale Connections als Ergänzung.
 *  Lokale Connections sind die Ground Truth für aktive Verbindungen auf
 *  dieser Instanz. Redis kann veraltete oder fehlende Einträge haben —
 *  lokale User werden daher immer hinzugefügt, auch wenn Redis verfügbar ist. */
async function getSnapshot(excludeId?: string): Promise<Array<{
  user_id: string; name: string; department?: string; x: number; y: number;
}>> {
  if (redisReady) {
    try {
      const prefix = `vo:${ROOM}:users:`;
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, batch] = await redisPub.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');

      const result = [];
      const seenIds = new Set<string>();
      console.log(`[Presence] getSnapshot redis keys=${keys.length}: [${keys.map(k => k.split(':').pop()).join(', ')}]`);
      for (const key of keys) {
        const userId = key.slice(prefix.length);
        if (userId === excludeId) continue;
        const d = await redisPub.hgetall(key);
        if (!d?.name) {
          console.log(`[Presence] getSnapshot skip key=${key} (kein name-Feld, Inhalt: ${JSON.stringify(d)})`);
          continue;
        }
        result.push({
          user_id:    userId,
          name:       d.name,
          department: d.department || undefined,
          x:          Number(d.x ?? 60),
          y:          Number(d.y ?? 45),
        });
        seenIds.add(userId);
      }

      // Lokale Connections ergänzen — deckt abgelaufene Redis-Keys und
      // User ab, die vor dem Redis-Connect verbunden haben
      for (const u of connections.values()) {
        if (u.user_id === excludeId) continue;
        if (seenIds.has(u.user_id)) continue; // schon aus Redis vorhanden
        result.push({ user_id: u.user_id, name: u.name, department: u.department, x: u.x, y: u.y });
      }

      return result;
    } catch (err) {
      console.warn('[Presence] Redis-Snapshot fehlgeschlagen, nutze lokale Connections:', (err as Error).message);
    }
  }

  // Fallback: lokale Connections
  return [...connections.values()]
    .filter((u) => u.user_id !== excludeId)
    .map(({ user_id, name, department, x, y }) => ({ user_id, name, department, x, y }));
}

/** Leitet ein Event lokal an den richtigen Empfänger weiter.
 *  Zielgerichtete Events (proximity_*, notify_user) gehen nur an den Zielnutzer;
 *  alle anderen werden an alle außer dem Sender gebroadcastet. */
function routeEventLocally(event: Record<string, unknown>): void {
  const type = String(event.type ?? '');
  const isTargeted = [
    'proximity_call', 'proximity_ended', 'proximity_redirect', 'notify_user',
  ].includes(type);

  if (isTargeted) {
    const targetId = String(event.targetUserId ?? '');
    const connectedIds = [...connections.values()].map((u) => u.user_id).join(', ');
    console.log(`[Presence] route ${type} → target=${targetId} connections=[${connectedIds}]`);
    let sent = false;
    for (const u of connections.values()) {
      if (u.user_id === targetId) {
        const msg = type === 'notify_user'
          ? { type: 'new_message', senderId: event.senderId }
          : event;
        sendTo(u.ws, msg);
        sent = true;
        break;
      }
    }
    if (!sent) {
      console.warn(`[Presence] ${type} → Ziel ${targetId} NICHT GEFUNDEN in connections=[${connectedIds}]`);
    }
    return;
  }

  const excludeId = typeof event.user_id === 'string' ? event.user_id : undefined;
  broadcastLocal(event, excludeId);
}

/** Publish via Redis — bei Fehler/Offline: direkt lokal routen. */
async function publishEvent(event: object): Promise<void> {
  if (redisReady) {
    try {
      await redisPub.publish(CHANNEL, JSON.stringify(event));
      return;
    } catch (err) {
      console.warn('[Presence] Redis-Publish fehlgeschlagen, fallback lokal:', (err as Error).message);
    }
  }
  routeEventLocally(event as Record<string, unknown>);
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveUserId(token?: string | null, botId?: string | null, isLocalhost = false): string {
  if (isLocalhost && botId) return botId;
  if (token) {
    const payload = decodeJwtPayload(token) as Record<string, unknown> | null;
    const id = payload
      ? String(payload.id ?? payload.userId ?? payload.sub ?? '')
      : '';
    if (id) return id;
  }
  return `g_${++guestCounter}`;
}

// ── Redis-Subscriber ──────────────────────────────────────────────────────────

redisSub.subscribe(CHANNEL, (err) => {
  if (err) console.error('[Presence] Redis-Subscribe Fehler:', err.message);
  else     console.log(`[Presence] Subscribed auf ${CHANNEL}`);
});

redisSub.on('message', (_ch: string, raw: string) => {
  try {
    const event = JSON.parse(raw) as Record<string, unknown>;
    routeEventLocally(event);
  } catch (err) {
    console.warn('[Presence] Ungültiges Redis-Event:', err);
  }
});

// ── Heartbeat: alle 60 s TTL der aktiven User in Redis erneuern ───────────────

setInterval(async () => {
  if (!redisReady || connections.size === 0) return;
  for (const u of connections.values()) {
    try { await redisPub.expire(userKey(u.user_id), USER_TTL); } catch { /* ignoriert */ }
  }
}, 60_000);

// ── WS-Server ─────────────────────────────────────────────────────────────────

export function attachPresenceWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  console.log('[Presence] WebSocket-Server initialisiert auf /ws');

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url     = new URL(req.url ?? '', 'http://x');
    const token   = url.searchParams.get('token');
    const botId   = url.searchParams.get('bot_id');
    const remote  = req.socket.remoteAddress ?? 'unknown';
    const isLocal = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    const userId  = resolveUserId(token, botId, isLocal);

    console.log(`[Presence] connect  userId=${userId} remote=${remote} isLocal=${isLocal} botId=${botId ?? '-'} redis=${redisReady ? 'ok' : 'offline'}`);

    const lastPos = await loadLastPos(userId);
    const user: UserInfo = { ws, user_id: userId, name: userId, x: lastPos.x, y: lastPos.y };
    connections.set(ws, user);

    try {
      const snapshot = await getSnapshot(userId);
      console.log(`[Presence] snapshot → userId=${userId} count=${snapshot.length} ids=[${snapshot.map(u => u.user_id).join(', ')}]`);
      sendTo(ws, { type: 'snapshot', users: snapshot });
    } catch (err) {
      console.error('[Presence] Snapshot-Fehler:', (err as Error).message);
      sendTo(ws, { type: 'snapshot', users: [] });
    }

    try {
      await saveUserState(user);
      console.log(`[Presence] saveUserState OK userId=${userId} x=${user.x} y=${user.y}`);
      await publishEvent({
        type: 'user_joined', user_id: user.user_id,
        name: user.name, x: user.x, y: user.y,
      });
    } catch (err) {
      console.error('[Presence] join-Event Fehler:', (err as Error).message);
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        const u = connections.get(ws);
        if (!u) return;

        switch (msg.type) {

          case 'set_name':
            u.name       = String(msg.name       ?? u.name);
            u.department = msg.department ? String(msg.department) : undefined;
            console.log(`[Presence] set_name  userId=${u.user_id} name=${u.name} dept=${u.department ?? '-'}`);
            await saveUserState(u);
            console.log(`[Presence] set_name  saveUserState OK userId=${u.user_id}`);
            await publishEvent({
              type: 'user_joined', user_id: u.user_id,
              name: u.name, department: u.department, x: u.x, y: u.y,
            });
            break;

          case 'move':
            u.x = Number(msg.x ?? u.x);
            u.y = Number(msg.y ?? u.y);
            await saveUserState(u);
            await saveLastPos(u.user_id, u.x, u.y);
            await publishEvent({ type: 'user_moved', user_id: u.user_id, x: u.x, y: u.y });
            break;

          case 'refresh_token':
            if (msg.token) {
              const payload = decodeJwtPayload(String(msg.token));
              const newId = payload
                ? String(payload.id ?? payload.userId ?? payload.sub ?? '')
                : '';
              if (newId) {
                console.log(`[Presence] refresh_token userId=${u.user_id} → ${newId}`);
                u.user_id = newId;
              }
            }
            break;

          case 'notify_user': {
            const targetId = String(msg.targetUserId ?? '');
            await publishEvent({ type: 'notify_user', targetUserId: targetId, senderId: u.user_id });
            break;
          }

          case 'proximity_enter': {
            // Nur eingeloggte (nicht Gast, nicht Bot) dürfen Calls initiieren
            if (u.user_id.startsWith('g_') || u.user_id.startsWith('bot_')) break;
            const targetId = String(msg.targetUserId ?? '');
            const roomName = String(msg.roomName     ?? '');
            const nonce    = Number(msg.nonce        ?? 0);
            if (!targetId || !roomName) break;
            console.log(`[Presence] proximity_enter from=${u.user_id} target=${targetId} room=${roomName} nonce=${nonce}`);
            await publishEvent({
              type: 'proximity_call', targetUserId: targetId,
              fromUserId: u.user_id, fromName: u.name, roomName, nonce,
            });
            break;
          }

          case 'proximity_exit': {
            const targetId = String(msg.targetUserId ?? '');
            const roomName = String(msg.roomName     ?? '');
            if (!targetId || !roomName) break;
            console.log(`[Presence] proximity_exit from=${u.user_id} target=${targetId} room=${roomName}`);
            await publishEvent({ type: 'proximity_ended', targetUserId: targetId, roomName });
            break;
          }

          case 'proximity_redirect': {
            const targetId     = String(msg.targetUserId  ?? '');
            const existingRoom = String(msg.existingRoom  ?? '');
            if (!targetId || !existingRoom) break;
            console.log(`[Presence] proximity_redirect from=${u.user_id} target=${targetId} room=${existingRoom}`);
            await publishEvent({
              type: 'proximity_redirect', targetUserId: targetId,
              fromUserId: u.user_id, fromName: u.name, existingRoom,
            });
            break;
          }

          case 'meeting_bg': {
            // Nur eingeloggte User dürfen den Hintergrund setzen
            if (u.user_id.startsWith('g_') || u.user_id.startsWith('bot_')) break;
            const backgroundUrl = msg.backgroundUrl === null ? null : String(msg.backgroundUrl ?? '');
            console.log(`[Presence] meeting_bg from=${u.user_id} url=${backgroundUrl ?? 'null'}`);
            await publishEvent({ type: 'meeting_bg', backgroundUrl });
            break;
          }

          case 'chat': {
            const text = String(msg.text ?? '').slice(0, 500);
            if (text) await publishEvent({ type: 'chat', userId: u.user_id, text });
            break;
          }
        }
      } catch (err) {
        console.warn('[Presence] Nachrichten-Fehler:', (err as Error).message);
      }
    });

    ws.on('close', async (code, reason) => {
      const u = connections.get(ws);
      connections.delete(ws);
      console.log(`[Presence] disconnect userId=${u?.user_id ?? '?'} code=${code} reason=${reason.toString() || '–'}`);
      if (u) {
        await saveLastPos(u.user_id, u.x, u.y).catch(() => {});
        await removeUserState(u.user_id).catch(() => {});
        await publishEvent({ type: 'user_left', user_id: u.user_id }).catch(() => {});
      }
    });

    ws.on('error', (err) => {
      console.warn(`[Presence] WS-Fehler userId=${connections.get(ws)?.user_id ?? '?'}:`, err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[Presence] WebSocketServer-Fehler:', err.message);
  });
}

export function getConnectedUsers(): UserInfo[] {
  return [...connections.values()];
}
