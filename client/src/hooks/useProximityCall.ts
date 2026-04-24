/**
 * Proximity-Call — startet automatisch einen LiveKit-Audioanruf,
 * wenn sich ein angemeldeter User einem anderen nähert.
 *
 * Schwellwerte: PROXIMITY_ENTER (rein) / PROXIMITY_EXIT (raus mit Hysterese)
 * Signalisierung: Presence-WebSocket (proximity_enter / proximity_exit)
 * LiveKit: separater _proxRoom-Singleton, unabhängig vom Meeting-Raum
 *
 * Tab-Fokus-Regel:
 *   - Tab fokussiert → Kamera + Mikro aktiv
 *   - Tab nicht fokussiert → nur Audio empfangen (kein Senden)
 */

import { useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useAuthStore } from '../model/stores/authStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { apiPost } from '../services/apiClient';
import { presenceSend } from './usePresence';
import { getJwtUserId } from '../services/objectClient';
import { PROXIMITY_ENTER, PROXIMITY_EXIT } from '../model/constants';

// ── Modul-Level Singletons ────────────────────────────────────────────────────

let _proxRoom:     Room   | null = null;
let _proxRoomName: string | null = null;
let _proxPartner:  string | null = null;

const FORCE_TURN = import.meta.env.VITE_LIVEKIT_FORCE_TURN === 'true';
const DETECTION_MS = 500;

// ── Aktiver-Anruf-State für UI (minimaler reaktiver Store) ───────────────────

export interface ActiveProxCall {
  partnerUserId: string;
  partnerName:   string;
  roomName:      string;
}

let _activeCall: ActiveProxCall | null = null;
const _uiListeners = new Set<() => void>();

function setActiveCall(state: ActiveProxCall | null) {
  _activeCall = state;
  _uiListeners.forEach((l) => l());
}

export function getActiveProxCall(): ActiveProxCall | null {
  return _activeCall;
}

export function subscribeActiveProxCall(listener: () => void): () => void {
  _uiListeners.add(listener);
  return () => _uiListeners.delete(listener);
}

// ── Event-Dispatch (usePresence → useProximityCall) ──────────────────────────

type ProxEventHandler = (event: Record<string, unknown>) => void;
let _proxEventHandler: ProxEventHandler | null = null;

export function setProxEventHandler(cb: ProxEventHandler | null): void {
  _proxEventHandler = cb;
}

export function dispatchProxEvent(event: Record<string, unknown>): void {
  _proxEventHandler?.(event);
}

// ── LiveKit Helpers ───────────────────────────────────────────────────────────

async function joinProxRoom(
  roomName:    string,
  partnerId:   string,
  partnerName: string,
  identity:    string,
  name:        string,
): Promise<void> {
  if (_proxRoom) {
    if (_proxRoomName === roomName) return; // schon verbunden
    await leaveProxRoom();
  }
  try {
    const { token, url } = await apiPost<{ token: string; url: string }>(
      '/api/livekit/token',
      { room: roomName, identity, name },
    );

    const room = new Room({ adaptiveStream: true, dynacast: true });
    _proxRoom     = room;
    _proxRoomName = roomName;
    _proxPartner  = partnerId;

    await room.connect(url, token, FORCE_TURN ? { rtcConfig: { iceTransportPolicy: 'relay' } } : {});

    // Kamera/Mic nur wenn Tab fokussiert; Audio immer empfangen
    const focused = !document.hidden;
    await room.localParticipant.setMicrophoneEnabled(focused).catch(() => {});
    await room.localParticipant.setCameraEnabled(focused).catch(() => {});

    setActiveCall({ partnerUserId: partnerId, partnerName, roomName });

    // Tab-Fokus-Änderungen dynamisch reagieren
    const onVisibility = async () => {
      if (!_proxRoom) return;
      const isFocused = !document.hidden;
      await _proxRoom.localParticipant.setMicrophoneEnabled(isFocused).catch(() => {});
      await _proxRoom.localParticipant.setCameraEnabled(isFocused).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    room.on(RoomEvent.Disconnected, () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (_proxRoom === room) {
        _proxRoom     = null;
        _proxRoomName = null;
        _proxPartner  = null;
        setActiveCall(null);
      }
    });

    console.log(`[ProxCall] Verbunden mit ${roomName}, Partner: ${partnerName}`);
  } catch (err) {
    console.warn('[ProxCall] joinProxRoom Fehler:', err);
    _proxRoom     = null;
    _proxRoomName = null;
    _proxPartner  = null;
    setActiveCall(null);
  }
}

export async function leaveProxRoom(): Promise<void> {
  const room = _proxRoom;
  _proxRoom     = null;
  _proxRoomName = null;
  _proxPartner  = null;
  setActiveCall(null);
  await room?.disconnect().catch(() => {});
  console.log('[ProxCall] Getrennt');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProximityCall() {
  const jwt    = useAuthStore((s) => s.jwt);
  const email  = useAuthStore((s) => s.email);
  const myName = usePlayerStore((s) => s.name);

  const identityRef = useRef(email || myName);
  const nameRef     = useRef(myName);
  identityRef.current = email || myName;
  nameRef.current     = myName;

  // Laufender Anruf — nur für Ausgangsanrufe (wird bei eingehenden per proxEventHandler gesetzt)
  const outgoingRef = useRef<{ userId: string; roomName: string } | null>(null);

  // ── Eingehende Events vom Presence-Server ──────────────────────────────────
  useEffect(() => {
    setProxEventHandler(async (event) => {
      if (event.type === 'proximity_call') {
        const fromUserId  = String(event.fromUserId ?? '');
        const fromName    = String(event.fromName   ?? '');
        const roomName    = String(event.roomName   ?? '');
        if (!roomName || !useAuthStore.getState().jwt) return;
        if (_proxRoomName === roomName) return; // schon drin
        console.log(`[ProxCall] Eingehend von ${fromName} (${fromUserId})`);
        await joinProxRoom(roomName, fromUserId, fromName, identityRef.current, nameRef.current);
      } else if (event.type === 'proximity_ended') {
        const roomName = String(event.roomName ?? '');
        if (_proxRoomName === roomName) {
          outgoingRef.current = null;
          await leaveProxRoom();
        }
      }
    });
    return () => setProxEventHandler(null);
  }, []); // bewusst leer — verwendet nur Refs und Modul-State

  // ── Proximity-Erkennungs-Loop ──────────────────────────────────────────────
  useEffect(() => {
    const myId = getJwtUserId();
    // Nur für eingeloggte, nicht-Gast-User
    if (!jwt || !myId || myId.startsWith('g_')) return;

    const interval = setInterval(() => {
      const id = getJwtUserId();
      if (!id || id.startsWith('g_')) return;

      const { wx, wy } = usePlayerStore.getState();
      const remoteUsers = usePresenceStore.getState().remoteUsers;

      // Nächsten eingeloggten (nicht-Bot, nicht-Gast) User finden
      let closestId   = '';
      let closestDist = Infinity;
      for (const [userId, user] of Object.entries(remoteUsers)) {
        if (userId.startsWith('bot_') || userId.startsWith('g_')) continue;
        const d = Math.hypot(wx - user.x, wy - user.y);
        if (d < closestDist) { closestDist = d; closestId = userId; }
      }

      const active = outgoingRef.current;

      if (!active && closestId && closestDist < PROXIMITY_ENTER) {
        // Call starten
        const partner  = remoteUsers[closestId];
        const roomName = 'prox_' + [id, closestId].sort().join('_');
        outgoingRef.current = { userId: closestId, roomName };
        presenceSend({ type: 'proximity_enter', targetUserId: closestId, roomName });
        joinProxRoom(roomName, closestId, partner.name, identityRef.current, nameRef.current);

      } else if (active) {
        const partner = remoteUsers[active.userId];
        const dist = partner ? Math.hypot(wx - partner.x, wy - partner.y) : Infinity;
        if (dist > PROXIMITY_EXIT) {
          // Call beenden
          presenceSend({ type: 'proximity_exit', targetUserId: active.userId, roomName: active.roomName });
          outgoingRef.current = null;
          leaveProxRoom();
        }
      }
    }, DETECTION_MS);

    return () => {
      clearInterval(interval);
      // Cleanup bei Unmount
      if (outgoingRef.current) {
        const { userId, roomName } = outgoingRef.current;
        presenceSend({ type: 'proximity_exit', targetUserId: userId, roomName });
        outgoingRef.current = null;
        leaveProxRoom();
      }
    };
  }, [jwt]); // jwt-Änderung → User ein-/ausloggen

  return { hangUp: leaveProxRoom };
}
