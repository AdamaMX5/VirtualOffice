import React, { useState } from 'react';
import { useDesignerStore } from '../../model/stores/designerStore';
import { createObject, putObject } from '../../services/objectClient';
import type { Room, Wall } from '../../model/types';

// ── Code-Export ───────────────────────────────────────────────────────────────

function formatRoom(r: Room): string {
  return `  { label: ${JSON.stringify(r.label)}, fill: ${JSON.stringify(r.fill)}, pts: [${r.pts.join(',')}] }`;
}

function formatWall(w: Wall): string {
  return `  { f:[${w.f[0]},${w.f[1]}], t:[${w.t[0]},${w.t[1]}], type:'wall' }`;
}

function generateCode(rooms: Room[], walls: Wall[]): string {
  const rLines = rooms.map(formatRoom).join(',\n');
  const wLines = walls.map(formatWall).join(',\n');
  return `export const ROOMS: Room[] = [\n${rLines}\n];\n\nexport const WALLS: Wall[] = [\n${wLines}\n];`;
}

// ── Stile ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'fixed', top: 16, right: 16, zIndex: 200,
  width: 280,
  background: 'rgba(15,23,42,0.96)',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 12,
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  overflow: 'hidden',
  pointerEvents: 'all',
};

const header: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(99,179,237,0.12)',
};

const headerTitle: React.CSSProperties = {
  color: '#e2e8f0', fontSize: 14, fontWeight: 700,
};

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  fontSize: 16, cursor: 'pointer', padding: '0 4px',
};

const statusBar: React.CSSProperties = {
  padding: '8px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  color: '#94a3b8', fontSize: 11,
  lineHeight: 1.6,
};

const snap: React.CSSProperties = {
  display: 'inline-block', borderRadius: 4, padding: '1px 6px', marginLeft: 4,
  background: 'rgba(99,179,237,0.12)', color: '#60a5fa', fontSize: 10, fontFamily: 'monospace',
};

const sectionTitle: React.CSSProperties = {
  color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase' as const, padding: '10px 16px 4px',
};

const roomRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 16px',
  borderTop: '1px solid rgba(255,255,255,0.04)',
};

const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  cursor: 'pointer', fontSize: 13, padding: '0 2px', marginLeft: 'auto',
  lineHeight: 1,
};

const actionBtn: React.CSSProperties = {
  display: 'block', width: '100%',
  padding: '9px 16px', textAlign: 'left' as const,
  background: 'none', border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
};

const exportModal: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 5000,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const exportCard: React.CSSProperties = {
  background: '#0f172a', border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 12, padding: 24, width: '90vw', maxWidth: 700,
  boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column', gap: 12,
};

// ── Komponente ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void; }

const DesignerPanel = ({ onClose }: Props) => {
  const {
    snapMode, completedRooms, completedWalls, points,
    deleteRoom, clearAll, savedId, setSavedId, loadDefault,
  } = useDesignerStore();
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');
  const [showExport,  setShowExport]  = useState(false);
  const [copied,      setCopied]      = useState(false);

  const snapLabel = snapMode === 'meter' ? '1 m'
                  : snapMode === 'decimeter' ? '0,1 m'
                  : '0,01 m';

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const data = {
        rooms: completedRooms as unknown as Record<string, unknown>[],
        walls: completedWalls as unknown as Record<string, unknown>[],
      };
      if (savedId) {
        await putObject('floor_plans', savedId, data);
      } else {
        const doc = await createObject('floor_plans', data, {}, 'VirtualOffice', false);
        setSavedId(doc._id);
      }
      setSaveMsg('Gespeichert ✓');
    } catch {
      setSaveMsg('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const code = generateCode(completedRooms, completedWalls);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <>
      <div style={panel}>
        <div style={header}>
          <span style={headerTitle}>📐 Grundriss Designer</span>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Status + Tastenkürzel */}
        <div style={statusBar}>
          Raster: <span style={snap}>{snapLabel}</span>
          <br />
          <span style={{ color: '#475569' }}>
            Shift = 0,1 m · Ctrl = 0,01 m · Esc = Abbrechen<br />
            Hover auf Punkte = Drag zum Verschieben
          </span>
          {points.length > 0 && (
            <>
              <br />
              <span style={{ color: '#f59e0b' }}>
                {points.length} Punkt{points.length !== 1 ? 'e' : ''} · zum Start-Punkt klicken um Raum zu schließen
              </span>
            </>
          )}
        </div>

        {/* Räume-Liste */}
        <div style={sectionTitle}>Räume ({completedRooms.length})</div>

        {completedRooms.length === 0 ? (
          <div style={{ padding: '8px 16px 12px', color: '#475569', fontSize: 12 }}>
            Noch keine Räume.{' '}
            <button
              style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer',
                fontSize: 12, padding: 0, textDecoration: 'underline' }}
              onClick={() => { if (window.confirm('Standardlayout laden und bisherige Änderungen verwerfen?')) loadDefault(); }}
            >
              Standardlayout laden
            </button>
          </div>
        ) : (
          completedRooms.map((room, i) => (
            <div key={i} style={roomRow}>
              <div style={{
                width: 16, height: 16, flexShrink: 0,
                background: room.fill, borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.1)',
              }} />
              <span style={{ color: '#e2e8f0', fontSize: 13, flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room.label}
              </span>
              <button style={delBtn} onClick={() => deleteRoom(i)} title="Raum löschen">✕</button>
            </div>
          ))
        )}

        {/* Aktionen */}
        {completedRooms.length > 0 && (
          <>
            <button
              style={{ ...actionBtn, color: '#60a5fa' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={() => setShowExport(true)}
            >
              📋 Als mapData.ts-Code exportieren
            </button>
            <button
              style={{ ...actionBtn, color: saving ? '#475569' : '#34d399' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Speichert…' : `💾 ${savedId ? 'Aktualisieren' : 'Speichern'}`}
              {saveMsg && <span style={{ marginLeft: 8, fontSize: 11, color: '#34d399' }}>{saveMsg}</span>}
            </button>
            <button
              style={{ ...actionBtn, color: '#94a3b8' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148,163,184,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={() => { if (window.confirm('Standardlayout laden und bisherige Änderungen verwerfen?')) loadDefault(); }}
            >
              🏢 Standardlayout laden
            </button>
            <button
              style={{ ...actionBtn, color: '#f87171' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={() => { if (window.confirm('Alle Räume löschen?')) clearAll(); }}
            >
              🗑️ Alles löschen
            </button>
          </>
        )}
      </div>

      {/* Export-Modal */}
      {showExport && (
        <div style={exportModal} onMouseDown={() => setShowExport(false)}>
          <div style={exportCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>
              mapData.ts — Code-Export
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Kopiere den Code und ersetze die ROOMS/WALLS-Exporte in <code>client/src/model/mapData.ts</code>.
            </div>
            <textarea
              readOnly
              value={code}
              style={{
                width: '100%', height: 320, resize: 'vertical',
                background: '#020617', color: '#94a3b8',
                border: '1px solid rgba(99,179,237,0.15)',
                borderRadius: 8, padding: 12, fontSize: 12,
                fontFamily: 'monospace', outline: 'none',
                boxSizing: 'border-box',
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{
                  flex: 1, padding: '9px 0',
                  background: copied ? 'rgba(34,197,94,0.2)' : '#2563eb',
                  border: copied ? '1px solid rgba(34,197,94,0.4)' : 'none',
                  borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
                onClick={handleCopy}
              >
                {copied ? '✅ Kopiert!' : '📋 In Zwischenablage kopieren'}
              </button>
              <button
                style={{
                  padding: '9px 20px',
                  background: 'transparent', border: '1px solid rgba(99,179,237,0.2)',
                  borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
                }}
                onClick={() => setShowExport(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DesignerPanel;
