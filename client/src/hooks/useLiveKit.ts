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
// Stored outside React so VideoGrid can access it without prop drilling.

let _room: Room | null = null;

/** Access the current LiveKit Room instance (may be null if disconnected). */
export function getRoom(): Room | null {
  return _room;
}

// When true, forces ICE relay (TURN only) – needed behind Cloudflare where
// most WebRTC UDP ports are blocked.  Set VITE_LIVEKIT_FORCE_TURN=true in .env
const FORCE_TURN = import.meta.env.VITE_LIVEKIT_FORCE_TURN === 'true';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveKit() {
  const store = useLiveKitStore();
  const { name: playerName } = usePlayerStore();
  const { email, authStatus } = useAuthStore();

  // ── helpers ────────────────────────────────────────────────────────────────

  const buildIdentity = useCallback((): string => {
    if (authStatus === 'connected_auth' && email) return email;
    const suffix = Math.random().toString(36).slice(2, 7);
    return `guest-${playerName || 'anon'}-${suffix}`;
  }, [authStatus, email, playerName]);

  const syncParticipants = useCallback(() => {
    if (!_room) return;
    const ids = Array.from(_room.remoteParticipants.keys());
    store.setParticipantIds(ids);
  }, [store]);

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async (roomName = 'main') => {
    if (_room) return; // already connected

    store.setStatus('connecting');
    store.setError(null);

    try {
      const identity = buildIdentity();

      const { token, url } = await apiPost<{ token: string; url: string }>(
        '/api/livekit/token',
        { room: roomName, identity, name: playerName || identity }
      );

      const room = new Room({ adaptiveStream: true, dynacast: true });
      _room = room;

      const connectOptions: RoomConnectOptions = FORCE_TURN
        ? { rtcConfig: { iceTransportPolicy: 'relay' } }
        : {};

      // ── room events ────────────────────────────────────────────────────────
      room.on(RoomEvent.ParticipantConnected,    syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackSubscribed,         () => { syncParticipants(); store.bumpTrackVersion(); });
      room.on(RoomEvent.TrackUnsubscribed,       () => { syncParticipants(); store.bumpTrackVersion(); });
      room.on(RoomEvent.LocalTrackPublished,     () => store.bumpTrackVersion());
      room.on(RoomEvent.LocalTrackUnpublished,   () => store.bumpTrackVersion());

      room.on(RoomEvent.Disconnected, () => {
        _room = null;
        store.reset();
      });

      await room.connect(url, token, connectOptions);

      store.setStatus('connected');
      store.setRoomName(roomName);
      syncParticipants();

      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);
      store.setMicEnabled(true);
      store.setCamEnabled(true);
    } catch (err) {
      _room = null;
      store.setStatus('error');
      store.setError(String(err));
    }
  }, [buildIdentity, playerName, store, syncParticipants]);

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    const room = _room;
    _room = null;
    store.reset();
    await room?.disconnect();
  }, [store]);

  // ── switchRoom ─────────────────────────────────────────────────────────────

  const switchRoom = useCallback(async (roomName: string) => {
    if (useLiveKitStore.getState().roomName === roomName) return;
    const room = _room;
    _room = null;
    store.reset();
    await room?.disconnect();
    await connect(roomName);
  }, [connect, store]);

  // ── media toggles ──────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const local = _room?.localParticipant;
    if (!local) return;
    const enabled = !local.isMicrophoneEnabled;
    await local.setMicrophoneEnabled(enabled);
    store.setMicEnabled(enabled);
  }, [store]);

  const toggleCam = useCallback(async () => {
    const local = _room?.localParticipant;
    if (!local) return;
    const enabled = !local.isCameraEnabled;
    await local.setCameraEnabled(enabled);
    store.setCamEnabled(enabled);
  }, [store]);

  const toggleSpeaker = useCallback(() => {
    const enabled = !useLiveKitStore.getState().speakerEnabled;
    store.setSpeakerEnabled(enabled);
    _room?.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          pub.track.mediaStreamTrack.enabled = enabled;
        }
      });
    });
  }, [store]);

  return { connect, disconnect, switchRoom, toggleMic, toggleCam, toggleSpeaker };
}
