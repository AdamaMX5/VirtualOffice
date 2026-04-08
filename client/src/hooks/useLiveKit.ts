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

// ── Module-level Room singleton ───────────────────────────────────────────────

let _room: Room | null = null;
let _connecting               = false;   // verhindert parallele connect()-Aufrufe
let _lastConnectAttempt       = 0;
const CONNECT_COOLDOWN_MS     = 3000;    // mind. 3s zwischen zwei Versuchen
let _failedConnect            = false;   // verhindert Reset nach fehlgeschlagenem connect()

export function getRoom(): Room | null {
  return _room;
}

const FORCE_TURN = import.meta.env.VITE_LIVEKIT_FORCE_TURN === 'true';

// Shorthand – alle Store-Aufrufe über getState(), damit keine React-Subscription
// auf den ganzen Store entsteht und Callbacks stabil bleiben.
const S = () => useLiveKitStore.getState();

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveKit() {
  // Nur die Werte lesen, die wirklich für stabile Callback-Deps gebraucht werden
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

    S().setStatus('connecting');
    S().setError(null);

    let room: Room | null = null;
    let attemptedUrl = '(Token-Abruf noch nicht abgeschlossen)';
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
        // Internes Reconnect deaktivieren – bei 401 ist ein neuer Token nötig,
        // blindes Retry macht es nur schlimmer.
        reconnectPolicy: { nextRetryDelayInMs: () => null },
      });
      _room = room;

      const connectOptions: RoomConnectOptions = (FORCE_TURN || forceTurn)
        ? { rtcConfig: { iceTransportPolicy: 'relay' } }
        : {};

      room.on(RoomEvent.ParticipantConnected,    syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackSubscribed,         () => { syncParticipants(); S().bumpTrackVersion(); });
      room.on(RoomEvent.TrackUnsubscribed,       () => { syncParticipants(); S().bumpTrackVersion(); });
      room.on(RoomEvent.LocalTrackPublished,     () => S().bumpTrackVersion());
      room.on(RoomEvent.LocalTrackUnpublished,   () => S().bumpTrackVersion());

      room.on(RoomEvent.Disconnected, () => {
        _room = null;
        if (!_failedConnect) {
          S().reset(); // nur bei echtem Disconnect zurücksetzen, nicht nach connect()-Fehler
        }
        _failedConnect = false;
      });

      await room.connect(url, token, connectOptions);

      S().setStatus('connected');
      S().setRoomName(roomName);
      syncParticipants();

      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);
      S().setMicEnabled(true);
      S().setCamEnabled(true);
      _connecting = false;
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
