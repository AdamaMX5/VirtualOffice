import React from 'react';
import { useCameraStore } from '../../model/stores/cameraStore';

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 100,
  background: 'rgba(15,15,19,0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 14px',
  color: 'rgba(255,255,255,0.35)',
  fontSize: 10,
  lineHeight: 1.8,
  backdropFilter: 'blur(8px)',
  pointerEvents: 'none',
};

const kbdStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  color: 'rgba(255,255,255,0.6)',
};

const ControlsHint = () => {
  const follow = useCameraStore((s) => s.follow);

  return (
    <div style={containerStyle}>
      <span style={kbdStyle}>W A S D</span> — Bewegen<br />
      <span style={kbdStyle}>Pfeiltasten</span> — Kamera<br />
      <span style={kbdStyle}>Shift</span> — Sprinten<br />
      <span style={kbdStyle}>Rechtsklick drag</span> — Kamera<br />
      <span style={kbdStyle}>Mausrad</span> — Zoom<br />
      <span style={kbdStyle}>F</span> — Kamera{' '}
      <span style={{ color: follow ? 'rgba(125,211,252,0.8)' : 'rgba(255,255,255,0.35)' }}>
        {follow ? '● folgt' : '○ frei'}
      </span>
    </div>
  );
};

export default ControlsHint;
