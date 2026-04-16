import WebSocket from 'ws';
import { config } from './config';

const BOT_X      = 55;
const BOT_Y      = 57;
const BOT_RADIUS = 3;

function randomWander(center: number, radius: number): number {
  return Math.round((center + (Math.random() * 2 - 1) * radius) * 10) / 10;
}

export function startReceptionBot(): void {
  let ws: WebSocket | null = null;
  let moveTimer:      ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>  | null = null;
  let reconnectDelay = 2_000;

  function send(msg: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function startWandering() {
    if (moveTimer) clearInterval(moveTimer);
    moveTimer = setInterval(() => {
      send({ type: 'move', x: randomWander(BOT_X, BOT_RADIUS), y: randomWander(BOT_Y, BOT_RADIUS) });
    }, 15_000);
  }

  function connect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    // Bot verbindet sich zum eigenen lokalen WS-Server
    const wsUrl = `ws://localhost:${config.PORT}/ws?bot_id=bot_empfang`;
    console.log(`[Bot] Verbinde zu lokalem Presence-Server ${wsUrl} …`);
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      reconnectDelay = 2_000;
      console.log('[Bot] Verbunden mit lokalem Presence-Server');
      send({ type: 'set_name', name: 'Empfang', department: 'bot' });
      send({ type: 'move', x: BOT_X, y: BOT_Y });
      startWandering();
    });

    ws.on('close', () => {
      if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
      console.log(`[Bot] Getrennt — Reconnect in ${reconnectDelay / 1000}s …`);
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    });

    ws.on('error', (err) => console.warn('[Bot] WS-Fehler:', err.message));
    ws.on('message', () => { /* noop */ });
  }

  // Kurze Verzögerung damit der HTTP-Server zuerst startet
  setTimeout(connect, 500);
}
