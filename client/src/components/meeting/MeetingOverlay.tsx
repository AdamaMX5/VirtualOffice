/**
 * MeetingOverlay – Vollbild-Gitteransicht aller Teilnehmer.
 * Keine Namen, keine Gitterlinien, alle Kacheln gleichgroß.
 */
import React, { useEffect, useRef, useReducer } from 'react';
import { Participant, ParticipantEvent, Track } from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { getRoom } from '../../hooks/useLiveKit';

// ── Grid-Berechnung ───────────────────────────────────────────────────────────

function gridDims(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 1, rows: 1 };
  if (n === 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

// ── MeetingTile ───────────────────────────────────────────────────────────────

interface TileProps {
  participant: Participant;
  isLocal: boolean;
  speakerEnabled: boolean;
}

const MeetingTile: React.FC<TileProps> = ({ participant, isLocal, speakerEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const reattach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);

      if (camPub?.track && videoRef.current) {
        (camPub.track as { attach(el: HTMLVideoElement): void }).attach(videoRef.current);
        setTimeout(() => videoRef.current?.play().catch(() => {}), 50);
      }
      if (micPub?.track && audioRef.current) {
        (micPub.track as { attach(el: HTMLAudioElement): void }).attach(audioRef.current);
      }
      forceUpdate();
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
    };
  }, [participant]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isLocal || !speakerEnabled;
  }, [speakerEnabled, isLocal]);

  const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;

  return (
    <div style={{ position: 'relative', background: '#111', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: hasCam ? 'block' : 'none',
        }}
      />
      {!hasCam && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          color: 'rgba(255,255,255,0.2)',
        }}>
          👤
        </div>
      )}
      <audio ref={audioRef} autoPlay muted={isLocal || !speakerEnabled} />
    </div>
  );
};

// ── MeetingOverlay ────────────────────────────────────────────────────────────

interface OverlayProps {
  onClose: () => void;
}

const MeetingOverlay: React.FC<OverlayProps> = ({ onClose }) => {
  const participantIds  = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled  = useLiveKitStore((s) => s.speakerEnabled);

  const room = getRoom();
  if (!room) return null;

  const remoteParticipants = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Alle Teilnehmer: eigene Person + Remote
  const total = 1 + remoteParticipants.length;
  const { cols, rows } = gridDims(total);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      background: '#0a0a0f',
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: 0,
    }}>
      {/* Eigene Kachel zuerst */}
      <MeetingTile
        participant={room.localParticipant}
        isLocal
        speakerEnabled={speakerEnabled}
      />

      {/* Remote-Teilnehmer */}
      {remoteParticipants.map((p) => (
        <MeetingTile
          key={p.identity}
          participant={p}
          isLocal={false}
          speakerEnabled={speakerEnabled}
        />
      ))}

      {/* Schließen-Button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 401,
          background: 'rgba(15,15,19,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          padding: '6px 14px',
          backdropFilter: 'blur(8px)',
        }}
      >
        ✕ Ansicht schließen
      </button>
    </div>
  );
};

export default MeetingOverlay;
