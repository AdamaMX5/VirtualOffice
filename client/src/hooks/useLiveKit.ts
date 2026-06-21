import { useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RoomConnectOptions,
} from 'livekit-client';
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useAuthStore } from '../model/stores/authStore';
import { apiPost } from '../services/apiClient';
import { hangUpProxCall } from './useProximityCall';

// ── Module-level Room singleton ───────────────────────────────────────────────

let _room: Room | null = null;
let _connecting               = false;   // prevents concurrent connect() calls
let _lastConnectAttempt       = 0;
const CONNECT_COOLDOWN_MS     = 3000;    // min. 3s between attempts
let _failedConnect            = false;   // prevents state reset after a failed connect()

export function getRoom(): Room | null {
  return _room;
}

const FORCE_TURN = import.meta.env.VITE_LIVEKIT_FORCE_TURN === 'true';

// Shorthand – all store calls via getState() to avoid subscribing to the whole
// store and to keep callbacks stable.
const S = () => useLiveKitStore.getState();

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveKit() {
  // Only read values that are actually needed for stable callback deps
  const playerName = usePlayerStore((s) => s.name);
  const email      = useAuthStore((s) => s.email);
  const authStatus = useAuthStore((s) => s.authStatus);

  // ── helpers ────────────────────────────────────────────────────────────────

  const buildIdentity = useCallback((): string => {
    if (authStatus === 'connected_auth' && email) return email;
    const suffix = Math.random().toString(36).slice(2, 7);
    return `guest-${playerName || 'anon'}-${suffix}`;
  }, [authStatus, email, playerName]);

  const syncParticipants = useCallback(() => {
    if (!_room) return;
    S().setParticipantIds(Array.from(_room.remoteParticipants.keys()));
  }, []);

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async (roomName = 'main', forceTurn = false) => {
    if (_room || _connecting) return;
    const now = Date.now();
    if (now - _lastConnectAttempt < CONNECT_COOLDOWN_MS) return;
    _connecting         = true;
    _lastConnectAttempt = now;

    await hangUpProxCall();

    S().setStatus('connecting');
    S().setError(null);

    let room: Room | null = null;
    let attemptedUrl = '(token fetch not yet complete)';
    try {
      const identity = buildIdentity();
      const { token, url } = await apiPost<{ token: string; url: string }>(
        '/api/livekit/token',
        { room: roomName, identity, name: playerName || identity },
      );
      attemptedUrl = url;

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Disable internal reconnect — a 401 requires a fresh token; blind retries make it worse.
        reconnectPolicy: { nextRetryDelayInMs: () => null },
      });
      _room = room;

      const connectOptions: RoomConnectOptions = (FORCE_TURN || forceTurn)
        ? { rtcConfig: { iceTransportPolicy: 'relay' } }
        : {};

      room.on(RoomEvent.ParticipantConnected,    syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackSubscribed,         syncParticipants);
      room.on(RoomEvent.TrackUnsubscribed,       syncParticipants);

      room.on(RoomEvent.Disconnected, () => {
        _room = null;
        if (!_failedConnect) {
          S().reset(); // only reset on a real disconnect, not after a failed connect()
        }
        _failedConnect = false;
      });

      await room.connect(url, token, connectOptions);

      S().setStatus('connected');
      S().setRoomName(roomName);
      syncParticipants();
      _connecting = false;

      // Enable mic/camera separately — device errors must not abort the meeting join
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        S().setMicEnabled(true);
      } catch (e) {
        console.warn('[LiveKit] Microphone enable failed:', e);
      }
      try {
        await room.localParticipant.setCameraEnabled(true);
        S().setCamEnabled(true);
      } catch (e) {
        console.warn('[LiveKit] Camera (default) failed, retrying without deviceId:', e);
        // Fallback: ignore cached deviceId
        try {
          await room.localParticipant.setCameraEnabled(true, { deviceId: undefined });
          S().setCamEnabled(true);
        } catch (e2) {
          console.warn('[LiveKit] Camera could not be enabled:', e2);
        }
      }
    } catch (err) {
      _failedConnect = true;
      await room?.disconnect().catch(() => {});
      _room       = null;
      _connecting = false;
      S().setStatus('error');
      const errMsg   = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? null) : null;
      S().setError(errMsg, attemptedUrl, errStack);
    }
  }, [buildIdentity, playerName, syncParticipants]);

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    const room = _room;
    _room = null;
    S().reset();
    await room?.disconnect();
  }, []);

  // ── switchRoom ─────────────────────────────────────────────────────────────

  const switchRoom = useCallback(async (roomName: string) => {
    if (S().roomName === roomName) return;
    const room = _room;
    _room = null;
    S().reset();
    await room?.disconnect();
    await connect(roomName);
  }, [connect]);

  // ── media toggles ──────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const local = _room?.localParticipant;
    if (!local) return;
    const enabled = !local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(enabled);
    S().setMicEnabled(enabled);
  }, []);

  const toggleCam = useCallback(async () => {
    const local = _room?.localParticipant;
    if (!local) return;
    const enabled = !local.isCameraEnabled;
    await local.setCameraEnabled(enabled);
    S().setCamEnabled(enabled);
  }, []);

  const toggleSpeaker = useCallback(() => {
    const enabled = !S().speakerEnabled;
    S().setSpeakerEnabled(enabled);
    _room?.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) pub.track.mediaStreamTrack.enabled = enabled;
      });
    });
  }, []);

  return { connect, disconnect, switchRoom, toggleMic, toggleCam, toggleSpeaker };
}
