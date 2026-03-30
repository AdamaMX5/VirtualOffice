import React, { useState } from 'react';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useLiveKit } from '../../hooks/useLiveKit';
import { reloadAllVideos } from '../../services/videoRegistry';

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(15,15,19,0.88)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,
  padding: '8px 14px',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  pointerEvents: 'all',
};

const btnBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '6px 10px',
  transition: 'background 0.15s',
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'rgba(79,70,229,0.6)',
  border: '1px solid rgba(124,58,237,0.7)',
};

const btnRed: React.CSSProperties = {
  ...btnBase,
  background: 'rgba(220,38,38,0.6)',
  border: '1px solid rgba(239,68,68,0.7)',
};

const joinBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.03em',
  padding: '7px 16px',
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  whiteSpace: 'nowrap',
};

const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 11,
  maxWidth: 220,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// ── Component ─────────────────────────────────────────────────────────────────

const ROOMS = ['main', 'meeting', 'lounge'];

const MediaControls: React.FC = () => {
  const status        = useLiveKitStore((s) => s.status);
  const roomName      = useLiveKitStore((s) => s.roomName);
  const micEnabled    = useLiveKitStore((s) => s.micEnabled);
  const camEnabled    = useLiveKitStore((s) => s.camEnabled);
  const speakerEnabled = useLiveKitStore((s) => s.speakerEnabled);
  const error         = useLiveKitStore((s) => s.error);
  const participantIds = useLiveKitStore((s) => s.participantIds);

  const { connect, disconnect, toggleMic, toggleCam, toggleSpeaker } = useLiveKit();

  const [selectedRoom, setSelectedRoom] = useState('main');
  const [forceTurn, setForceTurn] = useState(false);

  // ── not connected ──────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'error') {
    return (
      <div style={wrapStyle}>
        <span style={{ fontSize: 16 }}>🎙</span>
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            padding: '4px 6px',
            cursor: 'pointer',
          }}
        >
          {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={forceTurn}
            onChange={(e) => setForceTurn(e.target.checked)}
          />
          <span>TURN</span>
        </label>

        <button style={joinBtn} onClick={() => connect(selectedRoom)}>
          🎤 Beitreten
        </button>

        {error && <span style={errorStyle} title={error}>⚠ {error}</span>}
      </div>
    );
  }

  // ── connecting ─────────────────────────────────────────────────────────────
  if (status === 'connecting') {
    return (
      <div style={wrapStyle}>
        <span style={labelStyle}>⏳ Verbinde mit LiveKit...</span>
      </div>
    );
  }

  // ── connected ──────────────────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>
        #{roomName} &middot; {participantIds.length + 1} Teilnehmer
      </span>

      {/* Mic */}
      <button
        style={micEnabled ? btnActive : btnBase}
        title={micEnabled ? 'Mikrofon aus' : 'Mikrofon an'}
        onClick={toggleMic}
      >
        {micEnabled ? '🎤' : '🔇'}
      </button>

      {/* Cam */}
      <button
        style={camEnabled ? btnActive : btnBase}
        title={camEnabled ? 'Kamera aus' : 'Kamera an'}
        onClick={toggleCam}
      >
        {camEnabled ? '📷' : '📵'}
      </button>

      {/* Speaker */}
      <button
        style={speakerEnabled ? btnBase : btnActive}
        title={speakerEnabled ? 'Lautsprecher stumm' : 'Lautsprecher an'}
        onClick={toggleSpeaker}
      >
        {speakerEnabled ? '🔊' : '🔕'}
      </button>

      {/* Video-Streams neu laden */}
      <button style={btnBase} title="Video-Streams neu laden" onClick={reloadAllVideos}>
        🔄
      </button>

      {/* Hang up */}
      <button style={btnRed} title="Verlassen" onClick={disconnect}>
        📞
      </button>
    </div>
  );
};

export default MediaControls;
