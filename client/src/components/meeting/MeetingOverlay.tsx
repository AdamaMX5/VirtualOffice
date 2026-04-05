/**
 * MeetingOverlay – Vollbild-Gitteransicht aller Teilnehmer.
 * Keine Namen, keine Gitterlinien, alle Kacheln gleichgroß.
 */
import React, { useEffect, useRef, useReducer, useState, useCallback } from 'react';
import { Participant, ParticipantEvent, Track } from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useParticipantVolumeStore } from '../../model/stores/participantVolumeStore';
import { getRoom } from '../../hooks/useLiveKit';
import { useRecording } from '../../hooks/useRecording';

// ── Grid-Berechnung ───────────────────────────────────────────────────────────

function gridDims(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 1, rows: 1 };
  if (n === 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

// ── VolumeMenu ────────────────────────────────────────────────────────────────

interface VolumeMenuProps {
  identity: string;
  x: number;
  y: number;
  onClose: () => void;
}

const VolumeMenu: React.FC<VolumeMenuProps> = ({ identity, x, y, onClose }) => {
  const volume    = useParticipantVolumeStore((s) => s.getVolume(identity));
  const setVolume = useParticipantVolumeStore((s) => s.setVolume);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-volume-menu]')) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      data-volume-menu
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 600,
        background: 'rgba(15,15,19,0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        padding: '12px 16px',
        minWidth: 200,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: '#fff',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, opacity: 0.7 }}>
        Lautstärke: {Math.round(volume * 100)} %
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(identity, parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#4f8ef7', cursor: 'pointer' }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        opacity: 0.4,
        fontSize: 11,
        marginTop: 4,
      }}>
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>
  );
};

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

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const volume = useParticipantVolumeStore((s) => s.getVolume(participant.identity));

  // Tracks an- und abhängen
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

  // Lautstärke des Audio-Elements reaktiv halten
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(volume, 1); // HTMLAudioElement: max 1
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isLocal || !speakerEnabled;
  }, [speakerEnabled, isLocal]);

  const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isLocal) return; // eigene Lautstärke macht keinen Sinn
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, [isLocal]);

  return (
    <div
      style={{ position: 'relative', background: '#111', overflow: 'hidden', borderRadius: 10, aspectRatio: '16/9' }}
      onContextMenu={handleContextMenu}
    >
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

      {/* Lautstärke-Indikator (nur remote, nur wenn abweichend) */}
      {!isLocal && volume !== 1 && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 6,
          padding: '2px 7px',
          fontSize: 11,
          color: volume === 0 ? '#ef4444' : '#facc15',
          fontWeight: 700,
          pointerEvents: 'none',
        }}>
          {volume === 0 ? '🔇' : `${Math.round(volume * 100)}%`}
        </div>
      )}

      {menu && (
        <VolumeMenu
          identity={participant.identity}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};

// ── MeetingOverlay ────────────────────────────────────────────────────────────

interface OverlayProps {
  onClose: () => void;
}

const MeetingOverlay: React.FC<OverlayProps> = ({ onClose }) => {
  const participantIds = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled = useLiveKitStore((s) => s.speakerEnabled);
  const { isRecording, startRecording, stopRecording, tabHidden } = useRecording();

  const [bgUrl, setBgUrl]   = useState<string | null>(null);
  const bgInputRef          = useRef<HTMLInputElement>(null);

  const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(URL.createObjectURL(file));
  }, [bgUrl]);

  const handleClose = useCallback(() => {
    if (isRecording) stopRecording();
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    onClose();
  }, [isRecording, stopRecording, bgUrl, onClose]);

  const room = getRoom();
  if (!room) return null;

  const remoteParticipants = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const total = 1 + remoteParticipants.length;
  const { cols } = gridDims(total);

  const btnBase: React.CSSProperties = {
    background: 'rgba(15,15,19,0.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 14px',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      background: bgUrl
        ? `url(${bgUrl}) center / cover no-repeat`
        : '#0a0a0f',
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      alignContent: 'center',
      gap: '1.5%',
      padding: '1.5%',
      boxSizing: 'border-box',
    }}>
      {/* Versteckter File-Input für Hintergrundbild */}
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgUpload}
      />
      {/* Eigene Kachel zuerst */}
      <MeetingTile participant={room.localParticipant} isLocal speakerEnabled={speakerEnabled} />

      {/* Remote-Teilnehmer */}
      {remoteParticipants.map((p) => (
        <MeetingTile key={p.identity} participant={p} isLocal={false} speakerEnabled={speakerEnabled} />
      ))}

      {/* Tab-Warnung während Aufnahme */}
      {isRecording && tabHidden && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 500,
          background: 'rgba(220,38,38,0.92)',
          color: '#fff',
          textAlign: 'center',
          padding: '10px 16px',
          fontWeight: 700,
          fontSize: 14,
          backdropFilter: 'blur(4px)',
        }}>
          ⚠ Aufnahme läuft – Tab ist inaktiv! Das Video friert ein. Bitte Tab aktiv lassen.
        </div>
      )}

      {/* Steuer-Leiste oben rechts */}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 401,
        display: 'flex',
        gap: 8,
      }}>
        {/* Aufnahme-Button */}
        <button
          onClick={isRecording ? stopRecording : () => startRecording(bgUrl)}
          style={{
            ...btnBase,
            background: isRecording
              ? 'rgba(220,38,38,0.85)'
              : 'rgba(15,15,19,0.85)',
            border: isRecording
              ? '1px solid rgba(239,68,68,0.7)'
              : '1px solid rgba(255,255,255,0.15)',
          }}
          title={isRecording ? 'Aufnahme stoppen (WebM-Datei wird heruntergeladen)' : 'Aufnahme starten'}
        >
          {isRecording ? '⏹ Aufnahme stoppen' : '⏺ Aufnahme starten'}
        </button>

        {/* Hintergrundbild */}
        <button onClick={() => bgInputRef.current?.click()} style={btnBase} title="Hintergrundbild hochladen">
          {bgUrl ? '🖼 Hintergrund ändern' : '🖼 Hintergrund'}
        </button>
        {bgUrl && (
          <button onClick={() => { URL.revokeObjectURL(bgUrl); setBgUrl(null); }} style={btnBase} title="Hintergrund entfernen">
            ✕ Hintergrund
          </button>
        )}

        {/* Schließen-Button */}
        <button onClick={handleClose} style={btnBase}>
          ✕ Ansicht schließen
        </button>
      </div>
    </div>
  );
};

export default MeetingOverlay;
