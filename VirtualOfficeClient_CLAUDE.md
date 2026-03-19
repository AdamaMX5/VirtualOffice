# VirtualOfficeClient – CLAUDE.md

## Zweck
Browser-Client für das Virtual Office.
2D-Draufsicht mit Konva.js, WebSocket-Präsenz, Login/Gast-Flow, LiveKit Video/Audio.

## Stack (aktuell)
- Vanilla HTML + JavaScript (office-client.html)
- Konva.js 10 (Canvas-Rendering)
- Später: SvelteKit

## Verwandte Services
| Service | URL | Zweck |
|---|---|---|
| PresenceService | wss://presence.freischule.info/ws | Positionen, LiveKit-Tokens |
| AuthService | https://auth.freischule.info | Login, JWT, Refresh Token (httponly Cookie) |
| LiveKitService | wss://livekit.freischule.info | Video/Audio |

## Wichtige Konstanten (office-client.html)
```javascript
const AUTH_URL = 'https://auth.freischule.info';
const WS_URL   = 'wss://presence.freischule.info/ws';
const P        = 32;      // Pixel pro Meter
const WALK     = 4.8;     // m/s
const SPRINT   = 15.0;    // m/s
const MAP      = { w: 120, h: 100 };  // Meter
```

## Auth-Flow
```
1. showLoginModal() beim Start
2a. Gast: connectWebSocket(name)
2b. Login: POST /user/login → { email, access_token, status, roles }
           refresh_token kommt als httponly Cookie (Browser speichert automatisch)
3. connectWebSocket(email, access_token, email, roles)
4. Token-Refresh: alle 10min → POST /user/refresh (credentials: 'include')
   → neuen access_token per WebSocket { type: "refresh_token", token: "..." } senden
```

## WebSocket State
```javascript
let myJwt    = null;   // access_token
let myName   = '';     // email oder Gast-Name
let myEmail  = '';
let myRoles  = [];
```

## WebSocket Connect URL
```javascript
// Eingeloggt:
ws://presence.../ws?token=<jwt>&email=<email>&roles=USER,ADMIN

// Gast:
ws://presence.../ws
// dann: { type: "set_name", name: "Anna" }
```

## Reconnect
- Exponential Backoff: 1s → 2s → 4s → ... → 10s max
- Remote Users werden beim Disconnect geleert
- Reconnect nutzt gespeichertes myJwt automatisch

## Grundriss-Datenmodell
```javascript
// Punkte und Kanten als eigene Entitäten (keine Koordinaten pro Raum)
ROOMS = [{ label, fill, pts: [x1,y1, x2,y2, ...] }]
WALLS = [{ f:[x,y], t:[x,y], type: 'wall'|'shared'|'door' }]
// P (32) = Pixel pro Meter
```

## Smiley-Avatare
```javascript
createSmiley(name, isMe=false)
// isMe=true  → gelb (#facc15), gestrichelter Ring
// isMe=false → blau (#60a5fa)
// Name-Label: findOne('.nameLabel') zum Updaten
setSmileyName(group, name)
```

## Kamera-System
```javascript
cameraFollow = true    // Kamera folgt Spieler
// F-Taste: toggle
// Pfeiltasten: Kamera frei bewegen
// Rechtsklick-Drag: Kamera frei bewegen
// Mausrad: Zoom (rein=zum Cursor, raus=zur Bildmitte)
```

## HUD (position:fixed, außerhalb canvas-container!)
```html
<div id="hud">         <!-- position:fixed, z-index:100, pointer-events:none -->
  #status-display      <!-- 🟢/🔴/⏳ Verbindungsstatus -->
  #pos-display         <!-- aktuelle Position in Metern -->
  #zoom-display        <!-- aktueller Zoom-Level -->
  #btn-hud-login       <!-- pointer-events:all -->
</div>
```

## LiveKit Integration (TODO)
Wenn PresenceService `livekit_join` schickt:
```json
{ "type": "livekit_join", "room": "meetingraum", "room_type": "conference",
  "token": "...", "livekit_url": "wss://livekit.freischule.info" }
```
→ livekit-client SDK verbinden
→ Kamera/Mikro anfragen (`navigator.mediaDevices.getUserMedia`)
→ Video-Overlay über Canvas rendern

Wenn `livekit_leave` kommt → disconnecten

## Gast-System (geplant)
- Fog of War: Gäste sehen nur Flure + Zielbüro
- Einladungslink/QR-Code mit Token
- Navigationsstrich zum Zielraum
- Teleport-Button
- Gäste können kein Gespräch initiieren

## Deploy
Aktuell: statische HTML-Datei, direkt im Browser öffnen oder über Live Server.
Später: SvelteKit → `npm run build` → statische Files auf CDN/Webserver.

## Offene TODOs
- [ ] LiveKit Video-Overlay einbauen
- [ ] WS_URL auf wss://presence.freischule.info/ws ändern (nach Server-Deploy)
- [ ] Matrix Chat-Integration
- [ ] Fog of War für Gäste
- [ ] Grundriss-Editor
- [ ] SvelteKit Migration
