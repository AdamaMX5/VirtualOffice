import React from 'react';
import { useDesignerStore, DesignerMode } from '../../model/stores/designerStore';

const bar: React.CSSProperties = {
  position:   'fixed',
  bottom:     20,
  left:       '50%',
  transform:  'translateX(-50%)',
  zIndex:     200,
  display:    'flex',
  alignItems: 'center',
  gap:        6,
  background: 'rgba(15,23,42,0.96)',
  border:     '1px solid rgba(99,179,237,0.25)',
  borderRadius: 12,
  padding:    '8px 14px',
  backdropFilter: 'blur(8px)',
  boxShadow:  '0 8px 32px rgba(0,0,0,0.5)',
  pointerEvents: 'all',
};

const modeBtn = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(99,179,237,0.18)' : 'none',
  border:     active ? '1px solid rgba(99,179,237,0.45)' : '1px solid transparent',
  borderRadius: 8,
  color:      active ? '#93c5fd' : '#64748b',
  fontSize:   13,
  fontWeight: active ? 700 : 400,
  cursor:     'pointer',
  padding:    '6px 14px',
  whiteSpace: 'nowrap' as const,
  transition: 'all 0.15s',
});

const divider: React.CSSProperties = {
  width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0,
};

const hint: React.CSSProperties = {
  color: '#334155', fontSize: 11,
};

const DesignerToolbar: React.FC = () => {
  const { designerMode, setDesignerMode, points } = useDesignerStore();

  const setMode = (m: DesignerMode) => {
    if (points.length > 0) return; // don't switch mid-path
    setDesignerMode(m);
  };

  return (
    <div style={bar}>
      <button style={modeBtn(designerMode === 'draw')} onClick={() => setMode('draw')}>
        🖊 Zeichnen
      </button>
      <button style={modeBtn(designerMode === 'door')} onClick={() => setMode('door')}>
        🚪 Tür setzen
      </button>
      <div style={divider} />
      <span style={hint}>
        {designerMode === 'draw'
          ? (points.length === 0
              ? 'Hover = Punkte · Drag = Verschieben'
              : `${points.length} Punkt${points.length !== 1 ? 'e' : ''} · zum Start schließen`)
          : (points.length === 0
              ? '1. Klick: Tür-Start'
              : '2. Klick: Tür-Ende')
        }
      </span>
    </div>
  );
};

export default DesignerToolbar;
