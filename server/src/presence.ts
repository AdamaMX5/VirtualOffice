import WebSocket from 'ws';
import { config } from './config';

const BOT_X      = 55;
const BOT_Y      = 57;
const BOT_RADIUS = 3;

const ADMIN_X      = 95;
const ADMIN_Y      = 53;
const ADMIN_RADIUS = 4;

function randomWander(center: number, radius: number): number {
  return Math.round((center + (Math.random() * 2 - 1) * radius) * 10) / 10;
}

function createBot(opts: {
  botId:      string;
  name:       string;
  centerX:    number;
  centerY:    number;
  radius:     number;
  wanderMs:   number;
  keepaliveMs: number;
  startDelay: number;
}): void {
  let ws:             WebSocket | null = null;
  let wanderTimer:    ReturnType<typeof setInterval> | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>  | null = null;
  let reconnectDelay = 2_000;
  let curX = opts.centerX;
  let curY = opts.centerY;

  function send(msg: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function announce() {
    send({ type: 'set_name', name: opts.name, department: 'bot' });
    send({ type: 'move', x: curX, y: curY });
  }

  function startTimers() {
    if (wanderTimer)    clearInterval(wanderTimer);
    if (keepaliveTimer) clearInterval(keepaliveTimer);

    // Wandern: zufällige Position in der Nähe des Zentrums
    wanderTimer = setInterval(() => {
      curX = randomWander(opts.centerX, opts.radius);
      curY = randomWander(opts.centerY, opts.radius);
      send({ type: 'move', x: curX, y: curY });
    }, opts.wanderMs);

    // Keepalive: Bot kündigt sich regelmäßig neu an (für Clients die den
    // ersten user_joined verpasst haben oder nach Redis-Reconnect)
    keepaliveTimer = setInterval(() => {
      announce();
    }, opts.keepaliveMs);
  }

  function stopTimers() {
    if (wanderTimer)    { clearInterval(wanderTimer);    wanderTimer    = null; }
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
  }

  function connect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    const wsUrl = `ws://localhost:${config.PORT}/ws?bot_id=${opts.botId}`;
    console.log(`[Bot:${opts.botId}] Verbinde → ${wsUrl}`);
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      reconnectDelay = 2_000;
      console.log(`[Bot:${opts.botId}] Verbunden`);
      curX = opts.centerX;
      curY = opts.centerY;
      announce();
      startTimers();
    });

    ws.on('close', () => {
      stopTimers();
      console.log(`[Bot:${opts.botId}] Getrennt — Reconnect in ${reconnectDelay / 1000}s`);
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
    });

    ws.on('error', (err) => console.warn(`[Bot:${opts.botId}] Fehler:`, err.message));
    ws.on('message', () => { /* noop */ });
  }

  setTimeout(connect, opts.startDelay);
}

export function startReceptionBot(): void {
  createBot({
    botId:       'bot_empfang',
    name:        'Empfang',
    centerX:     BOT_X,
    centerY:     BOT_Y,
    radius:      BOT_RADIUS,
    wanderMs:    10_000,
    keepaliveMs: 25_000,
    startDelay:  500,
  });
}

export function startAdminBot(): void {
  createBot({
    botId:       'bot_admin',
    name:        'Admin',
    centerX:     ADMIN_X,
    centerY:     ADMIN_Y,
    radius:      ADMIN_RADIUS,
    wanderMs:    10_000,
    keepaliveMs: 25_000,
    startDelay:  700,
  });
}
