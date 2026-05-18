import React from 'react';
import { useCameraStore } from '../../model/stores/cameraStore';
import { useEngineStore } from '../../model/stores/engineStore';


const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

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
  pointerEvents: 'auto',
};

const kbdStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  color: 'rgba(255,255,255,0.6)',
};

const ControlsHint = () => {
  const follow  = useCameraStore((s) => s.follow);
  const engine  = useEngineStore((s) => s.engine);
  const toggle  = useEngineStore((s) => s.toggle);
  const isPixi  = engine === 'pixi';

  if (isTouchDevice) return null;

  return (
    <div style={containerStyle}>
      {/* Engine-Toggle */}
      <div style={{ marginBottom: 6, pointerEvents: 'auto' }}>
        <button
          onClick={toggle}
          style={{
            width: '100%',
            background: isPixi ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isPixi ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 6,
            color: isPixi ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
            letterSpacing: '0.03em',
          }}
        >
          {isPixi ? '⚡ PixiJS (WebGL)' : '🖥 Konva (Canvas2D)'}
        </button>
      </div>
      <span style={{ pointerEvents: 'none' }}>
        <span style={kbdStyle}>W A S D</span> — Bewegen<br />
        <span style={kbdStyle}>Pfeiltasten</span> — Kamera<br />
        <span style={kbdStyle}>Shift</span> — Sprinten<br />
        <span style={kbdStyle}>Rechtsklick drag</span> — Kamera<br />
        <span style={kbdStyle}>Mausrad</span> — Zoom<br />
        <span style={kbdStyle}>F</span> — Kamera{' '}
        <span style={{ color: follow ? 'rgba(125,211,252,0.8)' : 'rgba(255,255,255,0.35)' }}>
          {follow ? '● folgt' : '○ frei'}
        </span>
        <br />
        <span style={{ fontFamily: 'monospace', fontSize: 9 }}>
          v{__APP_VERSION__}
        </span>
      </span>
    </div>
  );
};

export default ControlsHint;
