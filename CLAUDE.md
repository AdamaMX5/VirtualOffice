# VirtualOffice

Virtual office space: participants move as avatars on a tile map, see each other in real time, can hold meetings and record them.

## Architecture
See @../../.claude/MSArchitecture/VirtualOfficeServer.md für die eigene API dokumentation und Zwischenlayer-Server.
See @../../.claude/MSArchitecture/AuthService.md für AuthService details (JWT verification, GITCLIENT role).
See @../../.claude/MSArchitecture/ProfileService.md für ProfileService details (Profile von userids).
See @../../.claude/MSArchitecture/ObjectService.md für ObjectService details (Persistenz).
See @../../.claude/MSArchitecture/MediaService.md für MediaService details (Bilder und Videos ).
See @../../.claude/MSArchitecture/EmailService.md für EmailService details (Sende Nachfragen zum Issue-Ersteller).
See @../../.claude/MSArchitecture/EmailService.md für ExceptionService details (Sende Fehlerfälle).
See @../../.claude/MSArchitecture/MessageService.md für MessageService details (Nachrichten zu anderen Usern).
See @../../.claude/MSArchitecture/RecordingService.md für RecordingService details (Serverseitige Aufnahmen von LiveKit Meetings).
See @../../.claude/MSArchitecture/GitService.md für GitService details (Issue creation)

## Monorepo Structure

```
/client   → React + Vite + Konva (SPA)
/server   → Express (Proxy + LiveKit token issuance + Reception bot)
```

`npm run dev` starts both in parallel via concurrently.

## Microservices in Use

| Service | Purpose |
|---|---|
| **AuthService** | Login/Register/Refresh — proxied by Express (`/api/auth/*`) |
| **Presence (integrated)** | WebSocket server directly in Express on `/ws` — `server/src/presenceWs.ts` |
| **LiveKit** | Video/audio rooms — token issuance via `/api/livekit/token`, egress via `/api/livekit/egress/*` |

ObjectService and MediaService are integrated (furniture catalog). ProfileService and ExceptionService are **not yet integrated**.

## Server — Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `AUTH_URL` | `https://auth.freischule.info` | AuthService |
| `PRESENCE_URL` | `https://presence.freischule.info` | PresenceService HTTP |
| `PRESENCE_WS_URL` | `wss://presence.freischule.info` | PresenceService WebSocket |
| `CLIENT_ORIGIN` | `https://office.freischule.info` | CORS origin |
| `LIVEKIT_URL` | `https://live.freischule.info` | LiveKit server |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit API key |
| `LIVEKIT_API_SECRET` | `devsecret` | LiveKit API secret |

## Client — Architecture Decisions

- **State**: Zustand stores (`playerStore`, `presenceStore`, `liveKitStore`, `cameraStore`, `participantVolumeStore`)
- **Rendering**: Konva canvas with a custom RAF loop (no `Konva.Animation`) — so video frames are redrawn every frame
- **LiveKit Room**: module-level singleton in `useLiveKit.ts` — no React state, no re-render on room events. Access via `getRoom()`
- **Video recording**: offscreen canvas (1920×1080) composites all camera tracks frame-accurately, no screen capture. Tiles are always 16:9 (`tileH = tileW * 9/16`)
- **VITE_LIVEKIT_FORCE_TURN**: `true` → forces TURN relay (for restrictive networks)

## Auth Standard — REQUIRED for all new features

JWT is held in `useAuthStore` (Zustand + `persist` middleware) and stored in `localStorage` under the key `vo_auth`.

### Unified check patterns

| Context | Pattern | File |
|---|---|---|
| React component (UI gate) | `const jwt = useAuthStore((s) => s.jwt);` / `const isAuth = jwt !== null;` | anywhere |
| Service / hook (outside React tree) | `useAuthStore.getState().jwt` | `objectClient.ts`, `messageClient.ts` |

**Rule**: Never use `authStatus === 'connected_auth'` for UI gates — this status depends on the WebSocket and is independent of login state. Only `jwt !== null` is authoritative.

### Example — button visible only when logged in
```tsx
const jwt = useAuthStore((s) => s.jwt);
if (!jwt) return null;
```

### Example — service function with auth
```ts
function requireJwt(): string {
  const jwt = useAuthStore.getState().jwt; // persist guarantees consistency
  if (!jwt) throw new Error('Not logged in');
  return jwt;
}
```

## Client — Important Constants

- `P` (`model/constants.ts`): pixels per tile on the canvas
- Tile sizes in VideoGrid: 128×72 px (16:9, only for the small HUD bar at the top)

## Reception Bot

`server/src/presence.ts` connects as a pseudo-user to PresenceService on startup and appears as a bot in the office. Bot detection in client: `user_id` starts with `bot_` or `name` ends with `_Bot`.

---

## Work Process

### Starting a new issue
Always begin a new GitHub issue / distinct task with `/clear` to start with a clean context. This prevents stale assumptions from a previous conversation from polluting the new task.

### Verify after each step
After completing each TODO step, verify that the code actually does what is intended before moving on to the next step. Do not batch verification at the end.

### Git workflow
Push to remote immediately after every commit:
```
git add <files> && git commit -m "..." && git push
```

---

## Code Language Rules

- **All code comments must be in English.** German comments are a translation debt.
- When touching a file, translate any German comments in that file as part of the change.
- UI strings visible to the user (button labels, messages) stay in German — only *code* comments must be English.

---

## Established React Patterns

### `hasCam` — always read at render time, never store in state
```tsx
// CORRECT: freshly read on every render, never stale after parent re-render
const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;

// WRONG: useState(hasCam) — becomes stale when the parent re-renders
// (e.g. after MeetingOverlay closes), because useState survives re-renders
const [hasCam, setHasCam] = useState(...); // ← don't do this for track state
```

### `forceUpdate` — trigger re-render from LiveKit track events
```tsx
const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
// call forceUpdate() inside event listeners (e.g. reattach) to re-read hasCam
const reattach = () => { detach(); attach(); forceUpdate(); };
```

### Track attach on mount — always call `setHasCam` / `forceUpdate` in `attach()`
`LocalTrackPublished` often fires before the component mounts. Call `forceUpdate()` (or read hasCam on render) inside `attach()` so the initial mount reads current track state even if the event was missed.

---

## Anti-Patterns — Never Use

### DOM mutation for visibility (React reconciler overwrites it)
```tsx
// WRONG — React resets style.display to the JSX value on every re-render
videoEl.style.display = 'block';

// CORRECT — let React control display via hasCam read at render time
<video style={{ display: hasCam ? 'block' : 'none' }} />
```

### `array.filter()` directly in a Zustand selector
```tsx
// WRONG — filter() always returns a new reference → triggers re-render on every store update
const knockers = useRoomLockStore((s) => s.knockers.filter((k) => k.room === 'Meetingraum'));

// CORRECT — stabilize with useMemo
const allKnockers = useRoomLockStore((s) => s.knockers);
const knockers    = useMemo(() => allKnockers.filter((k) => k.room === 'Meetingraum'), [allKnockers]);
```

### `admitted` as a dep when `setAdmitted()` is called in the same effect (React #185)
```tsx
// WRONG — causes React error #185 "Maximum update depth exceeded"
useEffect(() => {
  if (admitted) lockStore.setAdmitted(false); // modifies the dep inside the effect
}, [admitted, ...]);

// CORRECT — split into two separate effects; consume the flag in a dedicated effect
useEffect(() => { /* main logic, no admitted dep */ }, [currentRoom, connect, ...]);
useEffect(() => {
  if (!admitted) return;
  lockStore.setAdmitted(false); // safe: admitted is dep here, but this effect doesn't loop
}, [admitted, currentRoom, ...]);
```

---

## LiveKit-Specific Gotchas

- **Room singleton**: `_room` lives in `useLiveKit.ts` at module level. Access via `getRoom()`. The proximity call uses a separate singleton `_proxRoom` in `useProximityCall.ts`, accessed via `getProxRoom()`.
- **`setStatus('connected')` fires before `setCameraEnabled()`**: VideoGrid renders and `ParticipantTile` mounts before the camera is published. Always read track state inside `attach()` on mount, not only from events.
- **`LocalTrackPublished` race**: this room event fires immediately after `setCameraEnabled()` — often before the component that just rendered due to `status='connected'` has registered its listener. Mitigate by reading track state at render time (see hasCam pattern above).
- **`setParticipantIds` is idempotent**: returns the same state object when IDs haven't changed, so Zustand does not notify subscribers unnecessarily.
- **Proximity call and meeting room are independent**: `leaveProxRoom()` / `hangUpProxCall()` must be called before connecting to a meeting room to avoid two simultaneous LiveKit connections.
