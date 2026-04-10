@../MicroServiceArchitecture.md

# VirtualOffice

Virtueller Büro-Raum: Teilnehmer bewegen sich als Avatare auf einer Kachelkarte, sehen andere in Echtzeit, können Meetings abhalten und aufnehmen.

## Monorepo-Struktur

```
/client   → React + Vite + Konva (SPA)
/server   → Express (Proxy + LiveKit-Token-Ausgabe + Reception-Bot)
```

`npm run dev` startet beide parallel via concurrently.

## Genutzte Microservices

| Service | Wozu |
|---|---|
| **AuthService** | Login/Register/Refresh — wird vom Express-Server proxied (`/api/auth/*`) |
| **PresenceService** | WebSocket für Echtzeit-Positionen aller Nutzer — wird direkt vom Client via `usePresence` konsumiert |
| **LiveKit** | Video/Audio-Räume — Token-Ausgabe über `/api/livekit/token`, Egress über `/api/livekit/egress/*` |

ProfileService, ExceptionService, ObjectService, MediaService sind **noch nicht integriert**.

## Server — Env-Variablen

| Variable | Default | Beschreibung |
|---|---|---|
| `PORT` | `3000` | HTTP-Port |
| `AUTH_URL` | `https://auth.freischule.info` | AuthService |
| `PRESENCE_URL` | `https://presence.freischule.info` | PresenceService HTTP |
| `PRESENCE_WS_URL` | `wss://presence.freischule.info` | PresenceService WebSocket |
| `CLIENT_ORIGIN` | `https://office.freischule.info` | CORS-Origin |
| `LIVEKIT_URL` | `https://live.freischule.info` | LiveKit-Server |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit API Key |
| `LIVEKIT_API_SECRET` | `devsecret` | LiveKit API Secret |

## Client — Architektur-Entscheidungen

- **State**: Zustand-Stores (`playerStore`, `presenceStore`, `liveKitStore`, `cameraStore`, `participantVolumeStore`)
- **Rendering**: Konva-Canvas mit eigenem RAF-Loop (kein `Konva.Animation`) — damit Video-Frames jeden Frame neu gezeichnet werden
- **LiveKit Room**: Singleton auf Modul-Ebene in `useLiveKit.ts` — kein React-State, kein Re-Render bei Room-Events. Zugriff über `getRoom()`
- **Video-Aufnahme**: Offscreen-Canvas (1920×1080) compositet alle Kamera-Tracks frame-genau, kein Screen-Capture. Kacheln sind immer 16:9 (`tileH = tileW * 9/16`)
- **VITE_LIVEKIT_FORCE_TURN**: `true` → erzwingt TURN-Relay (für restriktive Netzwerke)

## Client — wichtige Konstanten

- `P` (`model/constants.ts`): Pixel pro Tile auf dem Canvas
- Tile-Größen in VideoGrid: 128×72 px (16:9, nur für die kleine HUD-Leiste oben)

## Reception-Bot

`server/src/presence.ts` verbindet sich beim Start als Pseudo-Nutzer zum PresenceService und erscheint als Bot im Büro. Bot-Erkennung im Client: `user_id` beginnt mit `bot_` oder `name` endet auf `_Bot`.
