import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

import { config } from './config';
import { proxyLogin, proxyRegister, proxyRefresh, normalizeAuth } from './proxies/authProxy';
import { startReceptionBot } from './presence';

const app = express();

app.use(cookieParser());
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password, deviceFingerprint, deviceName } = req.body as {
    email: string; password: string; deviceFingerprint?: string; deviceName?: string;
  };
  const { data, setCookie, status } = await proxyLogin(email, password, deviceFingerprint, deviceName);
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  if (status >= 400) {
    const detail = Array.isArray(data.detail)
      ? (data.detail as Array<{ msg: string }>).map(d => d.msg).join(', ')
      : String((data as Record<string, unknown>).detail ?? 'Login fehlgeschlagen');
    res.status(status).json({ error: detail });
    return;
  }
  res.json(normalizeAuth(data));
});

app.post('/api/auth/register', async (req, res) => {
  const { userid, repassword } = req.body as { userid: string; repassword: string };
  const { data, setCookie, status } = await proxyRegister(userid, repassword);
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  if (status >= 400) {
    const detail = Array.isArray(data.detail)
      ? (data.detail as Array<{ msg: string }>).map(d => d.msg).join(', ')
      : String((data as Record<string, unknown>).detail ?? 'Registrierung fehlgeschlagen');
    res.status(status).json({ error: detail });
    return;
  }
  res.json(normalizeAuth(data));
});

app.post('/api/auth/refresh', async (req, res) => {
  const incomingCookie = req.headers.cookie;
  const { data, setCookie, status } = await proxyRefresh(incomingCookie);
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  if (status >= 400) {
    res.status(status).json({ error: 'Session abgelaufen' });
    return;
  }
  res.json({ accessToken: (data.access_token ?? data.accessToken) as string });
});

// ── LiveKit Token ─────────────────────────────────────────────

app.post('/api/livekit/token', async (req, res) => {
  const { room, identity, name } = req.body as { room: string; identity: string; name?: string };
  if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    res.status(500).json({ error: 'LiveKit nicht konfiguriert (API Key/Secret fehlen)' });
    return;
  }
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name: name ?? identity,
    ttl: '1h',
  });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  res.json({ token, url: config.LIVEKIT_URL });
});

// ── Client Config ─────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
  res.json({ presenceWsUrl: config.PRESENCE_WS_URL });
});

// ── Static Client Build ───────────────────────────────────────

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*path', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Reception-Bot (verbindet sich als Client zum PresenceService) ──

startReceptionBot();

// ── HTTP-Server ───────────────────────────────────────────────

app.listen(config.PORT, () => {
  console.log(`Server läuft auf http://localhost:${config.PORT}`);
});
