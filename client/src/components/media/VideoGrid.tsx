import React, { useEffect, useRef, useReducer, useState } from 'react';
import {
  Participant,
  RemoteParticipant,
  ParticipantEvent,
  Track,
} from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { getRoom } from '../../hooks/useLiveKit';

// ── Styles ────────────────────────────────────────────────────────────────────

const TILE_W = 160;
const TILE_H = 120;

const gridWrapStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
};

const collapseBtn: React.CSSProperties = {
  alignSelf: 'flex-end',
  background: 'rgba(15,15,19,0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '3px 8px',
};

const tileStyle: React.CSSProperties = {
  position: 'relative',
  width: TILE_W,
  height: TILE_H,
  borderRadius: 8,
  overflow: 'hidden',
  background: '#1a1a2e',
  border: '1px solid rgba(255,255,255,0.1)',
  flexShrink: 0,
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const nameLabelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontSize: 11,
  padding: '2px 6px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const placeholderStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
};

// ── ParticipantTile ───────────────────────────────────────────────────────────

interface TileProps {
  participant: Participant;
  isLocal: boolean;
  speakerEnabled: boolean;
}

const ParticipantTile: React.FC<TileProps> = ({ participant, isLocal, speakerEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const reattach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);

      if (camPub?.track && videoRef.current) {
        (camPub.track as { attach(el: HTMLVideoElement): void }).attach(videoRef.current);
      }
      if (micPub?.track && audioRef.current) {
        (micPub.track as { attach(el: HTMLAudioElement): void }).attach(audioRef.current);
      }
      forceUpdate();
    };

    const detach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (camPub?.track && videoRef.current) {
        (camPub.track as { detach(el: HTMLVideoElement): void }).detach(videoRef.current);
      }
      if (micPub?.track && audioRef.current) {
        (micPub.track as { detach(el: HTMLAudioElement): void }).detach(audioRef.current);
      }
    };

    reattach();

    const events = [
      ParticipantEvent.TrackSubscribed,
      ParticipantEvent.TrackUnsubscribed,
      ParticipantEvent.TrackMuted,
      ParticipantEvent.TrackUnmuted,
      ParticipantEvent.TrackPublished,
      ParticipantEvent.TrackUnpublished,
    ];
    events.forEach((ev) => participant.on(ev as never, reattach as never));

    return () => {
      events.forEach((ev) => participant.off(ev as never, reattach as never));
      detach();
    };
  }, [participant]);

  // Sync audio mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isLocal || !speakerEnabled;
    }
  }, [speakerEnabled, isLocal]);

  const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;
  const displayName = participant.name || participant.identity || '?';

  return (
    <div style={tileStyle}>
      {/* Video immer im DOM – damit videoRef beim attach() verfügbar ist */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{ ...videoStyle, display: hasCam ? 'block' : 'none' }}
      />
      {!hasCam && (
        <div style={placeholderStyle}>
          <span style={{ fontSize: 28 }}>👤</span>
          <span>{displayName}</span>
        </div>
      )}
      <audio ref={audioRef} autoPlay />
      <div style={nameLabelStyle}>
        {isLocal ? '📹 Du' : displayName}
      </div>
    </div>
  );
};

// ── VideoGrid ─────────────────────────────────────────────────────────────────

const VideoGrid: React.FC = () => {
  const status        = useLiveKitStore((s) => s.status);
  const participantIds = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled = useLiveKitStore((s) => s.speakerEnabled);
  const [collapsed, setCollapsed] = useState(false);

  if (status !== 'connected') return null;

  const room = getRoom();
  if (!room) return null;

  const remoteParticipants: RemoteParticipant[] = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is RemoteParticipant => p !== undefined);

  return (
    <div style={gridWrapStyle}>
      <button style={collapseBtn} onClick={() => setCollapsed((v) => !v)}>
        {collapsed ? '📷 Anzeigen' : '▶ Verbergen'}
      </button>

      {!collapsed && (
        <>
          {/* Local self-view */}
          <ParticipantTile
            key="local"
            participant={room.localParticipant}
            isLocal
            speakerEnabled={speakerEnabled}
          />

          {/* Remote participants */}
          {remoteParticipants.map((p) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              isLocal={false}
              speakerEnabled={speakerEnabled}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default VideoGrid;
