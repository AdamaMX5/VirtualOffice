/**
 * Proximity-Call — startet automatisch einen LiveKit-Audioanruf,
 * wenn sich ein angemeldeter User einem anderen nähert.
 *
 * Schwellwerte: PROXIMITY_ENTER (rein) / PROXIMITY_EXIT (raus mit Hysterese)
 * Signalisierung: Presence-WebSocket (proximity_enter broadcast → alle prüfen selbst)
 * LiveKit: separater _proxRoom-Singleton, unabhängig vom Meeting-Raum
 * Raumname: prox_<initiatorUserId> — erlaubt Gruppe (3+ Personen im selben Raum)
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
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { apiPost } from '../services/apiClient';
import { presenceSend } from './usePresence';
import { getJwtUserId } from '../services/objectClient';
import { PROXIMITY_ENTER, PROXIMITY_EXIT } from '../model/constants';

// ── Modul-Level Singletons ────────────────────────────────────────────────────

let _proxRoom:     Room   | null = null;
let _proxRoomName: string | null = null;

export function getProxRoom(): Room | null { return _proxRoom; }

const LK = () => useLiveKitStore.getState();

const FORCE_TURN = import.meta.env.VITE_LIVEKIT_FORCE_TURN === 'true';
const DETECTION_MS = 500;

// ── Aktiver-Anruf-State für UI (minimaler reaktiver Store) ───────────────────

export interface ActiveProxCall {
  ownerUserId: string;
  partnerName: string;
  roomName:    string;
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
  console.log('[ProxCall] dispatchProxEvent handler vorhanden:', !!_proxEventHandler, 'event:', event.type);
  _proxEventHandler?.(event);
}

// ── LiveKit Helpers ───────────────────────────────────────────────────────────

async function joinProxRoom(
  roomName:    string,
  ownerUserId: string,
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

    await room.connect(url, token, FORCE_TURN ? { rtcConfig: { iceTransportPolicy: 'relay' } } : {});

    const focused = !document.hidden;
    await room.localParticipant.setMicrophoneEnabled(focused)
      .catch((e) => console.warn('[ProxCall] Mic aktivieren fehlgeschlagen:', e));
    await room.localParticipant.setCameraEnabled(focused)
      .catch((e) => console.warn('[ProxCall] Kamera aktivieren fehlgeschlagen:', e));

    setActiveCall({ ownerUserId, partnerName, roomName });

    if (!LK().isProxCall && LK().status !== 'connected') {
      const syncParts = () => LK().setParticipantIds([...room.remoteParticipants.keys()]);
      const bumpTrack = () => LK().bumpTrackVersion();
      LK().setIsProxCall(true);
      LK().setStatus('connected');
      syncParts();
      room.on(RoomEvent.ParticipantConnected,    syncParts);
      room.on(RoomEvent.ParticipantDisconnected, syncParts);
      room.on(RoomEvent.TrackSubscribed,         bumpTrack);
      room.on(RoomEvent.TrackUnsubscribed,       bumpTrack);
    }

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
        setActiveCall(null);
        if (LK().isProxCall) {
          LK().setIsProxCall(false);
          LK().setStatus('idle');
          LK().setParticipantIds([]);
        }
      }
    });

    console.log(`[ProxCall] Verbunden mit ${roomName}`);
  } catch (err) {
    console.warn('[ProxCall] joinProxRoom Fehler:', err);
    _proxRoom     = null;
    _proxRoomName = null;
    setActiveCall(null);
  }
}

export async function leaveProxRoom(): Promise<void> {
  const room = _proxRoom;
  _proxRoom     = null;
  _proxRoomName = null;
  setActiveCall(null);
  if (LK().isProxCall) {
    LK().setIsProxCall(false);
    LK().setStatus('idle');
    LK().setParticipantIds([]);
  }
  await room?.disconnect().catch(() => {});
  console.log('[ProxCall] Getrennt');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProximityCall() {
  const jwt    = useAuthStore((s) => s.jwt);
  const email  = useAuthStore((s) => s.email);
  const myName = usePlayerStore((s) => s.name);

  const guestFallback = useRef('guest-' + Math.random().toString(36).slice(2, 7));

  const identityRef = useRef(email || myName || guestFallback.current);
  const nameRef     = useRef(myName || guestFallback.current);
  identityRef.current = email || myName || guestFallback.current;
  nameRef.current     = myName || guestFallback.current;

  // Laufender Anruf: ownerUserId = wessen Raum (eigener wenn wir initiiert haben)
  const activeRef  = useRef<{ ownerUserId: string; roomName: string; isOwner: boolean } | null>(null);
  const prevPosRef = useRef<{ wx: number; wy: number } | null>(null);

  // ── Eingehende Events vom Presence-Server ──────────────────────────────────
  useEffect(() => {
    setProxEventHandler(async (event) => {

      if (event.type === 'proximity_call') {
        const fromUserId = String(event.fromUserId ?? '');
        const fromName   = String(event.fromName   ?? '');
        const roomName   = String(event.roomName   ?? '');
        console.log(`[ProxCall] proximity_call empfangen — from=${fromUserId} room=${roomName}`);
        if (!roomName) { console.log('[ProxCall] abgebrochen: kein roomName'); return; }

        // Eigene Broadcasts ignorieren
        const myId = getJwtUserId() || identityRef.current;
        console.log(`[ProxCall] myId=${myId} fromUserId=${fromUserId} gleich=${fromUserId === myId}`);
        if (fromUserId === myId) return;

        // Schon in einem Raum → ignorieren
        console.log(`[ProxCall] bereits in Raum: proxRoom=${!!_proxRoom} activeRef=${!!activeRef.current}`);
        if (_proxRoom || activeRef.current) return;

        // Nur beitreten wenn wir nah genug am Initiator sind
        const { wx, wy } = usePlayerStore.getState();
        const remoteUsers = usePresenceStore.getState().remoteUsers;
        const caller = remoteUsers[fromUserId];
        console.log(`[ProxCall] caller im Store: ${!!caller} remoteUsers keys: [${Object.keys(remoteUsers).join(', ')}]`);
        if (!caller) return;
        const dist = Math.hypot(wx - caller.x, wy - caller.y);
        console.log(`[ProxCall] Distanz zu caller: ${dist.toFixed(2)} PROXIMITY_ENTER=${PROXIMITY_ENTER}`);
        if (dist >= PROXIMITY_ENTER) return;

        console.log(`[ProxCall] Eingehend von ${fromName} (${fromUserId}), Raum: ${roomName}`);
        activeRef.current = { ownerUserId: fromUserId, roomName, isOwner: false };
        await joinProxRoom(roomName, fromUserId, fromName, identityRef.current, nameRef.current);

      } else if (event.type === 'proximity_ended') {
        const roomName = String(event.roomName ?? '');
        if (_proxRoomName === roomName) {
          activeRef.current = null;
          await leaveProxRoom();
        }
      }
    });
    return () => setProxEventHandler(null);
  }, []);

  // ── Proximity-Erkennungs-Loop ──────────────────────────────────────────────
  useEffect(() => {
    const myId = getJwtUserId();
    if (!jwt || !myId || myId.startsWith('g_')) return;

    prevPosRef.current = null;

    const interval = setInterval(() => {
      const id = getJwtUserId();
      if (!id || id.startsWith('g_')) return;

      const { wx, wy } = usePlayerStore.getState();

      const prev = prevPosRef.current;
      const selfMoved = prev !== null && Math.hypot(wx - prev.wx, wy - prev.wy) > 0.1;
      prevPosRef.current = { wx, wy };

      const remoteUsers = usePresenceStore.getState().remoteUsers;
      const active = activeRef.current;

      if (!active) {
        // Nur initiieren wenn wir uns selbst bewegt haben
        if (!selfMoved) return;

        let closestId   = '';
        let closestDist = Infinity;
        for (const [userId, user] of Object.entries(remoteUsers)) {
          if (userId.startsWith('bot_')) continue;
          const d = Math.hypot(wx - user.x, wy - user.y);
          if (d < closestDist) { closestDist = d; closestId = userId; }
        }

        if (closestId && closestDist < PROXIMITY_ENTER) {
          const partner  = remoteUsers[closestId];
          const roomName = 'prox_' + id;
          console.log(`[ProxCall] Initiiere Call → room=${roomName} target=${closestId}`);
          activeRef.current = { ownerUserId: id, roomName, isOwner: true };
          presenceSend({ type: 'proximity_enter', roomName });
          joinProxRoom(roomName, id, partner.name, identityRef.current, nameRef.current);
        }

      } else if (active.isOwner) {
        // Initiator bleibt solange IRGENDWER in der Nähe ist
        const anyoneClose = Object.values(remoteUsers).some((user) =>
          Math.hypot(wx - user.x, wy - user.y) < PROXIMITY_EXIT,
        );
        if (!anyoneClose) {
          presenceSend({ type: 'proximity_exit', roomName: active.roomName });
          activeRef.current = null;
          leaveProxRoom();
        }

      } else {
        // Joiner verlässt wenn der Initiator zu weit weg ist
        const owner = remoteUsers[active.ownerUserId];
        const ownerDist = owner ? Math.hypot(wx - owner.x, wy - owner.y) : Infinity;
        if (ownerDist > PROXIMITY_EXIT) {
          activeRef.current = null;
          leaveProxRoom();
        }
      }
    }, DETECTION_MS);

    return () => {
      clearInterval(interval);
      if (activeRef.current?.isOwner) {
        presenceSend({ type: 'proximity_exit', roomName: activeRef.current.roomName });
      }
      activeRef.current = null;
      leaveProxRoom();
    };
  }, [jwt]);

  return { hangUp: leaveProxRoom };
}
