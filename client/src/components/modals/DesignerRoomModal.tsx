import React, { useEffect, useState } from 'react';
import { useDesignerStore } from '../../model/stores/designerStore';

const PRESET_COLORS = [
  { label: 'Grau',       value: '#585858' },
  { label: 'Dunkelblau', value: '#1a2744' },
  { label: 'Warmbraun',  value: '#3d2a1a' },
  { label: 'Grün',       value: '#1a3d2a' },
  { label: 'Violett',    value: '#2a1a3d' },
  { label: 'Oliv',       value: '#3d3d1a' },
  { label: 'Bordeaux',   value: '#3d1a1a' },
  { label: 'Dunkel',     value: '#111827' },
];

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 4000,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const card: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 12, padding: '24px 28px',
  minWidth: 320, maxWidth: 420,
  boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
};

const title: React.CSSProperties = {
  color: '#e2e8f0', fontSize: 18, fontWeight: 700, marginBottom: 18,
};

const label: React.CSSProperties = {
  color: '#64748b', fontSize: 12, marginBottom: 4,
};

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1e293b', border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 6, padding: '8px 12px',
  color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16,
};

const colorGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16,
};

const btnRow: React.CSSProperties = { display: 'flex', gap: 10, marginTop: 8 };

const confirmBtn: React.CSSProperties = {
  flex: 1, padding: '9px 0',
  background: '#2563eb', border: 'none', borderRadius: 8,
  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};

const cancelBtn: React.CSSProperties = {
  flex: 1, padding: '9px 0',
  background: 'transparent', border: '1px solid rgba(99,179,237,0.2)',
  borderRadius: 8, color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};

const DesignerRoomModal = () => {
  const { pendingRoom, confirmRoom, discardPendingRoom } = useDesignerStore();
  const [roomLabel, setRoomLabel] = useState('');
  const [fill, setFill]           = useState(PRESET_COLORS[0].value);

  useEffect(() => {
    if (pendingRoom) { setRoomLabel(''); setFill(PRESET_COLORS[0].value); }
  }, [pendingRoom]);

  if (!pendingRoom) return null;

  const handleConfirm = () => {
    if (!roomLabel.trim()) return;
    confirmRoom(roomLabel.trim(), fill);
  };

  return (
    <div style={overlay} onMouseDown={discardPendingRoom}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={title}>Raum konfigurieren</div>

        <div style={label}>Raumname</div>
        <input
          style={input}
          autoFocus
          value={roomLabel}
          onChange={(e) => setRoomLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') discardPendingRoom(); }}
          placeholder="z. B. Büro A"
        />

        <div style={label}>Bodenfarbe</div>
        <div style={colorGrid}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => setFill(c.value)}
              style={{
                width: '100%', aspectRatio: '1', background: c.value,
                border: fill === c.value ? '2px solid #60a5fa' : '2px solid transparent',
                borderRadius: 6, cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={label}>Benutzerdefiniert:</div>
          <input
            type="color"
            value={fill}
            onChange={(e) => setFill(e.target.value)}
            style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
          />
          <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{fill}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 60, height: 30, background: fill,
            borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)',
          }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            {roomLabel.trim() || '(kein Name)'}
          </span>
        </div>

        <div style={btnRow}>
          <button style={cancelBtn} onClick={discardPendingRoom}>Verwerfen</button>
          <button
            style={{ ...confirmBtn, opacity: roomLabel.trim() ? 1 : 0.4 }}
            onClick={handleConfirm}
            disabled={!roomLabel.trim()}
          >
            Raum hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignerRoomModal;
