import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

interface User {
  user_id: string;
  name: string;
  department: string;
  x: number;
  y: number;
}

let counter = 0;
const users = new Map<string, User>();
const sockets = new Map<string, WebSocket>();

// ── Empfangs-Bot ──────────────────────────────────────────────
const BOT: User = {
  user_id: 'bot_reception',
  name: 'Empfang',
  department: 'Reception',
  x: 55,
  y: 57,
};
users.set(BOT.user_id, BOT);

function broadcast(msg: object, excludeId?: string) {
  const json = JSON.stringify(msg);
  for (const [uid, ws] of sockets) {
    if (uid !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

export function setupPresence(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== '/ws') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    const user_id = `u_local_${Date.now()}_${++counter}`;
    const user: User = { user_id, name: 'Guest', department: '', x: 60, y: 45 };
    // Snapshot OHNE den neuen User selbst senden (verhindert Ghost-User am Spawnpunkt)
    const snapshotUsers = Array.from(users.values()).map(u => ({ type: 'user_joined', ...u }));
    console.log(`[Presence] snapshot → ${user_id}: [${snapshotUsers.map(u => u.user_id).join(', ')}]`);
    ws.send(JSON.stringify({ type: 'snapshot', users: snapshotUsers }));

    // Erst jetzt eintragen, damit der User sich nicht selbst im Snapshot sieht
    users.set(user_id, user);
    sockets.set(user_id, ws);

    // Anderen Usern den Beitritt melden
    broadcast({ type: 'user_joined', ...user }, user_id);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.type === 'set_name' && typeof msg.name === 'string') {
          user.name = msg.name;
          broadcast({ type: 'user_joined', ...user }, user_id);
        } else if (msg.type === 'move' && typeof msg.x === 'number' && typeof msg.y === 'number') {
          user.x = msg.x;
          user.y = msg.y;
          broadcast({ type: 'user_moved', user_id, x: msg.x, y: msg.y }, user_id);
        }
        // refresh_token: kein Handlungsbedarf im lokalen Server
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      users.delete(user_id);
      sockets.delete(user_id);
      broadcast({ type: 'user_left', user_id });
      console.log(`[Presence] ${user.name} (${user_id}) disconnected. Users online: ${users.size}`);
    });

    console.log(`[Presence] New connection: ${user_id}. Users online: ${users.size}`);
  });

  console.log('[Presence] Lokaler WebSocket-Server bereit auf /ws');
}
