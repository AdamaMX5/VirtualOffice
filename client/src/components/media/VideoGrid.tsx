import React, { useEffect, useRef, useState, useReducer } from 'react';
import { Participant, RemoteParticipant, ParticipantEvent, Track } from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { getRoom } from '../../hooks/useLiveKit';
import { getProxRoom } from '../../hooks/useProximityCall';

const TILE_W = 128;
const TILE_H = 72; // 16:9

// ── ParticipantTile ───────────────────────────────────────────────────────────

interface TileProps {
  participant: Participant;
  isLocal: boolean;
  speakerEnabled: boolean;
}

const ParticipantTile: React.FC<TileProps> = ({ participant, isLocal, speakerEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Read directly at render time — never stale, even after parent re-renders
  const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    const detach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (camPub?.track && videoEl)
        (camPub.track as { detach(el: HTMLVideoElement): void }).detach(videoEl);
      if (micPub?.track && audioEl)
        (micPub.track as { detach(el: HTMLAudioElement): void }).detach(audioEl);
    };

    const attach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (camPub?.track && videoEl) {
        (camPub.track as { attach(el: HTMLVideoElement): void }).attach(videoEl);
        const tryPlay = () => videoEl.play().catch(() => {});
        tryPlay();
        videoEl.addEventListener('canplay', tryPlay, { once: true });
        setTimeout(tryPlay, 300);
      }
      if (micPub?.track && audioEl && !isLocal) {
        (micPub.track as { attach(el: HTMLAudioElement): void }).attach(audioEl);
      }
    };

    const reattach = () => { detach(); attach(); forceUpdate(); };

    attach();

    const events = [
      ParticipantEvent.TrackSubscribed, ParticipantEvent.TrackUnsubscribed,
      ParticipantEvent.TrackMuted,      ParticipantEvent.TrackUnmuted,
      ParticipantEvent.TrackPublished,  ParticipantEvent.TrackUnpublished,
    ];
    events.forEach((ev) => participant.on(ev as never, reattach as never));
    return () => {
      events.forEach((ev) => participant.off(ev as never, reattach as never));
      detach();
    };
  }, [participant, isLocal]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isLocal || !speakerEnabled;
  }, [speakerEnabled, isLocal]);

  const displayName = participant.name || participant.identity || '?';

  return (
    <div style={{
      position: 'relative',
      width: TILE_W,
      height: TILE_H,
      borderRadius: 6,
      overflow: 'hidden',
      background: '#1a1a2e',
      border: '1px solid rgba(255,255,255,0.1)',
      flexShrink: 0,
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasCam ? 'block' : 'none' }}
      />
      {!hasCam && (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: 'rgba(255,255,255,0.3)',
        }}>
          👤
        </div>
      )}
      <audio ref={audioRef} autoPlay muted={isLocal || !speakerEnabled} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.55)',
        color: '#fff', fontSize: 10,
        padding: '2px 5px',
        textAlign: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {isLocal ? 'Du' : displayName}
      </div>
    </div>
  );
};

// ── VideoGrid ─────────────────────────────────────────────────────────────────

const VideoGrid: React.FC = () => {
  const status         = useLiveKitStore((s) => s.status);
  const participantIds = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled = useLiveKitStore((s) => s.speakerEnabled);
  const isProxCall     = useLiveKitStore((s) => s.isProxCall);
  const [collapsed, setCollapsed] = useState(false);

  if (status !== 'connected') return null;
  const room = isProxCall ? getProxRoom() : getRoom();
  if (!room) return null;

  const remoteParticipants: RemoteParticipant[] = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is RemoteParticipant => p !== undefined);

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      maxWidth: 'calc(100vw - 220px)',
      overflowX: 'auto',
    }}>
      {!collapsed && (
        <>
          <ParticipantTile participant={room.localParticipant} isLocal speakerEnabled={speakerEnabled} />
          {remoteParticipants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} isLocal={false} speakerEnabled={speakerEnabled} />
          ))}
        </>
      )}

      {/* Collapse-Button */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          alignSelf: 'center',
          background: 'rgba(15,15,19,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          fontSize: 11,
          padding: '4px 8px',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}
        title={collapsed ? 'Kameras anzeigen' : 'Kameras verbergen'}
      >
        {collapsed ? '▶ Kameras' : '✕'}
      </button>
    </div>
  );
};

export default VideoGrid;
