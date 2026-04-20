import React from 'react';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { useCameraStore } from '../../model/stores/cameraStore';
import { useAuthStore } from '../../model/stores/authStore';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useMessageStore } from '../../model/stores/messageStore';

const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const hudStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'max(16px, env(safe-area-inset-top, 0px))',
  left: 'max(16px, env(safe-area-inset-left, 0px))',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  pointerEvents: 'none',
  maxWidth: isTouchDevice ? 160 : 220,
};

const badgeStyle: React.CSSProperties = {
  background: 'rgba(15,15,19,0.85)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: isTouchDevice ? '4px 8px' : '6px 12px',
  color: 'rgba(255,255,255,0.7)',
  fontSize: isTouchDevice ? 11 : 12,
  backdropFilter: 'blur(8px)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const spanStyle: React.CSSProperties = { color: '#7dd3fc', fontWeight: 600 };

const loginBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '7px 14px',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.03em',
  pointerEvents: 'all',
};

const meetingBtnStyle: React.CSSProperties = {
  background: 'rgba(139,92,246,0.7)',
  border: '1px solid rgba(167,139,250,0.5)',
  borderRadius: 8,
  padding: '7px 14px',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.03em',
  pointerEvents: 'all',
};

function wsStatusColor(status: string): string {
  if (status === 'connected')    return '#86efac';
  if (status === 'connecting')   return '#fbbf24';
  if (status === 'reconnecting') return '#fca5a5';
  return '#fca5a5';
}

function wsStatusLabel(status: string): string {
  if (status === 'connected')    return '🟢 Verbunden';
  if (status === 'connecting')   return '⏳ Verbinde...';
  if (status === 'reconnecting') return '🔴 Verbinde erneut...';
  return '🔴 Nicht verbunden';
}

interface HUDProps {
  onOpenMeeting?: () => void;
  onToggleFurniture?: () => void;
  furnitureModeActive?: boolean;
  onToggleMessages?: () => void;
  messagesPanelOpen?: boolean;
}

const HUD = ({ onOpenMeeting, onToggleFurniture, furnitureModeActive, onToggleMessages, messagesPanelOpen }: HUDProps) => {
  const { wx, wy, currentRoom } = usePlayerStore();
  const scale         = useCameraStore((s) => s.scale);
  const wsStatus      = usePresenceStore((s) => s.wsStatus);
  const authStatus    = useAuthStore((s) => s.authStatus);
  const openModal     = useAuthStore((s) => s.openModal);
  const liveKitStatus = useLiveKitStore((s) => s.status);
  const unreadTotal   = useMessageStore((s) => s.unreadTotal);

  const jwt          = useAuthStore((s) => s.jwt);
  const isAuth       = jwt !== null;
  const showLoginBtn = !isAuth;
  const inMeeting    = currentRoom === 'Meetingraum';
  const meetingReady = inMeeting && liveKitStatus === 'connected';

  return (
    <>
    <div style={hudStyle}>
      <div style={badgeStyle}>
        <span style={{ color: wsStatusColor(wsStatus) }}>{wsStatusLabel(wsStatus)}</span>
      </div>
      {!isTouchDevice && (
        <div style={badgeStyle}>
          Position: <span style={spanStyle}>{wx.toFixed(1)}m, {wy.toFixed(1)}m</span>
        </div>
      )}
      {!isTouchDevice && (
        <div style={badgeStyle}>
          Zoom: <span style={spanStyle}>{Math.round(scale * 100)}%</span>
        </div>
      )}
      {inMeeting && !meetingReady && (
        <div style={badgeStyle}>
          <span style={{ color: '#fbbf24' }}>⏳ Meetingraum wird verbunden...</span>
        </div>
      )}
      {meetingReady && (
        <button style={meetingBtnStyle} onClick={onOpenMeeting}>
          📺 Ansicht
        </button>
      )}
      {isAuth && (
        <button
          style={{
            ...meetingBtnStyle,
            background: furnitureModeActive
              ? 'rgba(99,179,237,0.7)'
              : 'rgba(15,15,19,0.85)',
            border: furnitureModeActive
              ? '1px solid rgba(99,179,237,0.8)'
              : '1px solid rgba(255,255,255,0.15)',
          }}
          onClick={onToggleFurniture}
        >
          🪑 {furnitureModeActive ? 'Möbelmodus aktiv' : 'Möbel'}
        </button>
      )}
      {isAuth && (
        <button
          onClick={onToggleMessages}
          style={{
            ...meetingBtnStyle,
            background: messagesPanelOpen
              ? 'rgba(79,142,247,0.7)'
              : 'rgba(15,15,19,0.85)',
            border: messagesPanelOpen
              ? '1px solid rgba(99,179,237,0.8)'
              : '1px solid rgba(255,255,255,0.15)',
            position: 'relative',
          }}
        >
          💬 Nachrichten
          {unreadTotal > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: '#ef4444',
              color: '#fff', fontSize: 10, fontWeight: 700,
              borderRadius: 10, padding: '1px 6px',
              minWidth: 18, textAlign: 'center',
              lineHeight: '16px',
            }}>
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </button>
      )}
      {showLoginBtn && (
        <button style={loginBtnStyle} onClick={openModal}>
          🔑 Einloggen
        </button>
      )}
    </div>
    <div style={{
      position: 'fixed', bottom: 8, right: 12,
      color: 'rgba(255,255,255,0.25)', fontSize: 10,
      fontFamily: 'monospace', pointerEvents: 'none', zIndex: 100,
    }}>
      v{__APP_VERSION__}
    </div>
    </>
  );
};

export default HUD;
