import React from 'react';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { useCameraStore } from '../../model/stores/cameraStore';
import { useAuthStore } from '../../model/stores/authStore';

const hudStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'none',
};

const badgeStyle: React.CSSProperties = {
  background: 'rgba(15,15,19,0.85)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 12px',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  backdropFilter: 'blur(8px)',
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

const HUD = () => {
  const { wx, wy } = usePlayerStore();
  const scale      = useCameraStore((s) => s.scale);
  const wsStatus   = usePresenceStore((s) => s.wsStatus);
  const authStatus = useAuthStore((s) => s.authStatus);
  const openModal  = useAuthStore((s) => s.openModal);

  const showLoginBtn = authStatus !== 'connected_auth';

  return (
    <div style={hudStyle}>
      <div style={badgeStyle}>
        <span style={{ color: wsStatusColor(wsStatus) }}>{wsStatusLabel(wsStatus)}</span>
      </div>
      <div style={badgeStyle}>
        Position: <span style={spanStyle}>{wx.toFixed(1)}m, {wy.toFixed(1)}m</span>
      </div>
      <div style={badgeStyle}>
        Zoom: <span style={spanStyle}>{Math.round(scale * 100)}%</span>
      </div>
      {showLoginBtn && (
        <button style={loginBtnStyle} onClick={openModal}>
          🔑 Einloggen
        </button>
      )}
    </div>
  );
};

export default HUD;
