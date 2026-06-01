/**
 * MeetingOverlay – Vollbild-Gitteransicht aller Teilnehmer.
 * Im Screenshare-Modus: Screen links, Teilnehmer-Streifen 208 px rechts.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo, useReducer } from 'react';
import { Participant, ParticipantEvent, Track, RoomEvent } from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useParticipantVolumeStore } from '../../model/stores/participantVolumeStore';
import { useMessageStore } from '../../model/stores/messageStore';
import { useMeetingStore } from '../../model/stores/meetingStore';
import { useRoomLockStore } from '../../model/stores/roomLockStore';
import { useAuthStore } from '../../model/stores/authStore';
import { getRoom } from '../../hooks/useLiveKit';
import { useRecording } from '../../hooks/useRecording';
import { presenceSend } from '../../hooks/usePresence';
import { loadMeetingBg } from '../../services/meetingService';
import BgPicker from './BgPicker';

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
        position: 'fixed', left: x, top: y, zIndex: 600,
        background: 'rgba(15,15,19,0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10, padding: '12px 16px', minWidth: 200,
        backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: '#fff', fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, opacity: 0.7 }}>
        Lautstärke: {Math.round(volume * 100)} %
      </div>
      <input
        type="range" min={0} max={2} step={0.05} value={volume}
        onChange={(e) => setVolume(identity, parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#4f8ef7', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.4, fontSize: 11, marginTop: 4 }}>
        <span>0%</span><span>100%</span><span>200%</span>
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
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  const hasCam = !!participant.getTrackPublication(Track.Source.Camera)?.track;

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const volume = useParticipantVolumeStore((s) => s.getVolume(participant.identity));

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
        setTimeout(() => videoEl.play().catch(() => {}), 50);
      }
      if (micPub?.track && audioEl && !isLocal)
        (micPub.track as { attach(el: HTMLAudioElement): void }).attach(audioEl);
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
    if (audioRef.current) audioRef.current.volume = Math.min(volume, 1);
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isLocal || !speakerEnabled;
  }, [speakerEnabled, isLocal]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isLocal) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, [isLocal]);

  return (
    <div
      style={{ position: 'relative', background: '#111', overflow: 'hidden', borderRadius: 10, aspectRatio: '16/9' }}
      onContextMenu={handleContextMenu}
    >
      <video ref={videoRef} autoPlay playsInline muted={isLocal}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasCam ? 'block' : 'none' }} />
      {!hasCam && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: 'rgba(255,255,255,0.2)' }}>
          👤
        </div>
      )}
      <audio ref={audioRef} autoPlay muted={isLocal || !speakerEnabled} />
      {!isLocal && volume !== 1 && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: volume === 0 ? '#ef4444' : '#facc15', fontWeight: 700, pointerEvents: 'none' }}>
          {volume === 0 ? '🔇' : `${Math.round(volume * 100)}%`}
        </div>
      )}
      {menu && <VolumeMenu identity={participant.identity} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
};

// ── ScreenShareTile ───────────────────────────────────────────────────────────

const ScreenShareTile: React.FC<{ participant: Participant }> = ({ participant }) => {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate]   = useReducer((n: number) => n + 1, 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const detach = () => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track) (pub.track as { detach(el: HTMLVideoElement): void }).detach(videoEl);
    };
    const attach = () => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track) {
        (pub.track as { attach(el: HTMLVideoElement): void }).attach(videoEl);
        videoEl.play().catch(() => {});
      }
    };
    const reattach = () => { detach(); attach(); forceUpdate(); };

    attach();
    const events = [
      ParticipantEvent.TrackSubscribed,  ParticipantEvent.TrackUnsubscribed,
      ParticipantEvent.TrackPublished,   ParticipantEvent.TrackUnpublished,
    ];
    events.forEach((ev) => participant.on(ev as never, reattach as never));
    return () => {
      events.forEach((ev) => participant.off(ev as never, reattach as never));
      detach();
    };
  }, [participant]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  const name = participant.name || participant.identity || '?';

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <video ref={videoRef} autoPlay playsInline muted
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', top: 10, left: 12, color: 'rgba(255,255,255,0.45)', fontSize: 12, pointerEvents: 'none' }}>
        🖥 {name}
      </div>
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(15,15,19,0.85)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          padding: '5px 12px', backdropFilter: 'blur(8px)',
        }}
      >
        {isFullscreen ? '⊠ Vollbild beenden' : '⊡ Vollbild'}
      </button>
    </div>
  );
};

// ── MeetingOverlay ────────────────────────────────────────────────────────────

interface OverlayProps {
  onClose: () => void;
}

const MeetingOverlay: React.FC<OverlayProps> = ({ onClose }) => {
  const participantIds    = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled    = useLiveKitStore((s) => s.speakerEnabled);
  const liveKitStatus     = useLiveKitStore((s) => s.status);
  const unreadTotal       = useMessageStore((s) => s.unreadTotal);
  const messagesPanelOpen = useMessageStore((s) => s.panelOpen);
  const toggleMessages    = useMessageStore((s) => s.togglePanel);
  const bgUrl             = useMeetingStore((s) => s.bgUrl);
  const { isRecording, startRecording, stopRecording, tabHidden } = useRecording();

  const lockedRooms = useRoomLockStore((s) => s.lockedRooms);
  const allKnockers = useRoomLockStore((s) => s.knockers);
  const knockers    = useMemo(
    () => allKnockers.filter((k) => k.room === 'Meetingraum'),
    [allKnockers],
  );
  const myId    = useAuthStore.getState().userId;
  const isLocked  = 'Meetingraum' in lockedRooms;
  const lockOwner = lockedRooms['Meetingraum'];
  const amOwner   = lockOwner === myId;

  const handleToggleLock = useCallback(() => {
    presenceSend({ type: 'room_lock', room: 'Meetingraum', locked: !isLocked });
  }, [isLocked]);
  const handleAdmit = useCallback((userId: string) => {
    presenceSend({ type: 'room_admit', room: 'Meetingraum', userId });
    useRoomLockStore.getState().removeKnocker(userId, 'Meetingraum');
  }, []);
  const handleDeny = useCallback((userId: string) => {
    useRoomLockStore.getState().removeKnocker(userId, 'Meetingraum');
  }, []);

  const [showBgPicker, setShowBgPicker] = useState(false);

  useEffect(() => {
    if (!useMeetingStore.getState().bgObjectId) loadMeetingBg();
  }, []);

  const handleClose = useCallback(() => {
    if (isRecording) stopRecording();
    onClose();
  }, [isRecording, stopRecording, onClose]);

  // ── Screen-Share-Erkennung ─────────────────────────────────────────────────
  // Rerender wenn sich Track-Publikationen ändern (z.B. Screenshare start/stop)
  const [, forceOverlay] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const room = getRoom();
    if (!room) return;
    const update = () => forceOverlay();
    room.on(RoomEvent.LocalTrackPublished,   update);
    room.on(RoomEvent.LocalTrackUnpublished, update);
    room.on(RoomEvent.TrackSubscribed,       update);
    room.on(RoomEvent.TrackUnsubscribed,     update);
    return () => {
      room.off(RoomEvent.LocalTrackPublished,   update);
      room.off(RoomEvent.LocalTrackUnpublished, update);
      room.off(RoomEvent.TrackSubscribed,       update);
      room.off(RoomEvent.TrackUnsubscribed,     update);
    };
  }, [liveKitStatus]);

  const toggleScreenShare = useCallback(async () => {
    const room = getRoom();
    if (!room) return;
    try {
      const isSharing = !!room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (isSharing) {
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        await room.localParticipant.setScreenShareEnabled(true, { audio: true });
      }
      forceOverlay();
    } catch (e) {
      console.warn('[Meeting] Screenshare fehlgeschlagen:', e);
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const room = getRoom();

  if (!room || liveKitStatus !== 'connected') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 400, background: '#0a0a0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
          {liveKitStatus === 'connecting' ? '⏳ Verbinde mit Meetingraum…' : '⚠ Meetingraum nicht verbunden'}
        </div>
        <button onClick={onClose} style={{ background: 'rgba(15,15,19,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 14px', backdropFilter: 'blur(8px)' }}>
          ✕ Schließen
        </button>
      </div>
    );
  }

  const remoteParticipants = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Screen-Share-Zustand frisch beim Render lesen
  const isLocalSharing = !!room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
  const screenSharer: Participant | null = isLocalSharing
    ? room.localParticipant
    : (remoteParticipants.find((p) => !!p.getTrackPublication(Track.Source.ScreenShare)?.track) ?? null);
  const hasScreenShare = !!screenSharer;

  const { cols } = gridDims(1 + remoteParticipants.length);

  const btnBase: React.CSSProperties = {
    background: 'rgba(15,15,19,0.85)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    padding: '6px 14px', backdropFilter: 'blur(8px)',
  };

  const toolbar = (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 401, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button onClick={handleToggleLock} style={{ ...btnBase, background: isLocked ? 'rgba(239,68,68,0.25)' : btnBase.background, border: isLocked ? '1px solid rgba(239,68,68,0.5)' : btnBase.border }} title={isLocked ? 'Raum entsperren' : 'Raum abschließen'}>
        {isLocked ? '🔒 Gesperrt' : '🔓 Offen'}
      </button>

      <button onClick={toggleScreenShare} style={{ ...btnBase, background: isLocalSharing ? 'rgba(79,142,247,0.7)' : btnBase.background, border: isLocalSharing ? '1px solid rgba(99,179,237,0.8)' : btnBase.border }} title={isLocalSharing ? 'Screenshare beenden' : 'Bildschirm teilen'}>
        {isLocalSharing ? '🖥 Stop' : '🖥 Screenshare'}
      </button>

      <button onClick={isRecording ? stopRecording : () => startRecording(bgUrl)} style={{ ...btnBase, background: isRecording ? 'rgba(220,38,38,0.85)' : btnBase.background, border: isRecording ? '1px solid rgba(239,68,68,0.7)' : btnBase.border }} title={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}>
        {isRecording ? '⏹ Stoppen' : '⏺ Aufnahme'}
      </button>

      <button onClick={() => setShowBgPicker(true)} style={btnBase} title="Hintergrundbild wählen oder hochladen">
        🖼 Hintergrund
      </button>

      <button onClick={toggleMessages} style={{ ...btnBase, background: messagesPanelOpen ? 'rgba(79,142,247,0.7)' : btnBase.background, border: messagesPanelOpen ? '1px solid rgba(99,179,237,0.8)' : btnBase.border, position: 'relative' }}>
        💬 Nachrichten
        {unreadTotal > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: '16px' }}>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      <button onClick={handleClose} style={btnBase}>✕ Schließen</button>
    </div>
  );

  const tabWarning = isRecording && tabHidden && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, background: 'rgba(220,38,38,0.92)', color: '#fff', textAlign: 'center', padding: '10px 16px', fontWeight: 700, fontSize: 14, backdropFilter: 'blur(4px)' }}>
      ⚠ Aufnahme läuft – Tab ist inaktiv! Das Video friert ein. Bitte Tab aktiv lassen.
    </div>
  );

  const waitingRoom = isLocked && amOwner && (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 402, background: 'rgba(15,15,19,0.92)', border: '1px solid rgba(255,200,50,0.3)', borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(10px)', minWidth: 240, maxWidth: 400 }}>
      <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>🚪 WARTEZIMMER</div>
      {knockers.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Niemand wartet.</div>
      ) : (
        knockers.map((k) => (
          <div key={k.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
            <button onClick={() => handleAdmit(k.userId)} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 6, color: '#86efac', fontSize: 12, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Einlassen</button>
            <button onClick={() => handleDeny(k.userId)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 12, padding: '3px 10px', cursor: 'pointer' }}>Ablehnen</button>
          </div>
        ))
      )}
    </div>
  );

  // ── Screenshare-Layout ────────────────────────────────────────────────────────
  if (hasScreenShare) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'row', background: '#0a0a0f' }}>
        {showBgPicker && <BgPicker currentUrl={bgUrl} onClose={() => setShowBgPicker(false)} />}

        {/* Screenshare-Hauptfläche */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <ScreenShareTile participant={screenSharer!} />
        </div>

        {/* Teilnehmer-Streifen 208 px rechts */}
        <div style={{
          width: 208, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '8px 8px 8px 8px', paddingTop: 62,
          overflowY: 'auto',
          background: bgUrl ? `url(${bgUrl}) center/cover no-repeat` : 'rgba(12,12,18,0.97)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
        }}>
          <MeetingTile participant={room.localParticipant} isLocal speakerEnabled={speakerEnabled} />
          {remoteParticipants.map((p) => (
            <MeetingTile key={p.identity} participant={p} isLocal={false} speakerEnabled={speakerEnabled} />
          ))}
        </div>

        {toolbar}
        {tabWarning}
        {waitingRoom}
      </div>
    );
  }

  // ── Normal-Grid-Layout ────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: bgUrl ? `url(${bgUrl}) center / cover no-repeat` : '#0a0a0f',
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      alignContent: 'center',
      gap: '1.5%', padding: '1.5%', boxSizing: 'border-box',
    }}>
      {showBgPicker && <BgPicker currentUrl={bgUrl} onClose={() => setShowBgPicker(false)} />}
      <MeetingTile participant={room.localParticipant} isLocal speakerEnabled={speakerEnabled} />
      {remoteParticipants.map((p) => (
        <MeetingTile key={p.identity} participant={p} isLocal={false} speakerEnabled={speakerEnabled} />
      ))}
      {toolbar}
      {tabWarning}
      {waitingRoom}
    </div>
  );
};

export default MeetingOverlay;
