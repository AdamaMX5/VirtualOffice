import React, { useEffect, useRef, useState } from 'react';
import { useDesignerStore } from '../../model/stores/designerStore';
import { useMapStore } from '../../model/stores/mapStore';
import { createObject, putObject } from '../../services/objectClient';
import { parseMapDocument, toMapDocument } from '../../model/mapData';
import type { Room, Wall, MapDocument } from '../../model/types';

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

// ── Preset-Farben (für Raum-Bearbeitung) ──────────────────────────────────────

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
    snapMode, completedRooms, completedWalls, points, spawnPoint,
    deleteRoom, renameRoom, clearAll, savedId, setSavedId, loadDefault, loadFromMap, importData,
  } = useDesignerStore();
  const [saving,           setSaving]           = useState(false);
  const [saveMsg,          setSaveMsg]          = useState('');
  const [showExport,       setShowExport]       = useState(false);
  const [copied,           setCopied]           = useState(false);
  const [editingRoomIdx,   setEditingRoomIdx]   = useState<number | null>(null);
  const [editLabel,        setEditLabel]        = useState('');
  const [editFill,         setEditFill]         = useState('#585858');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing floor plan into designer — wait until async map loader has finished
  const mapLoaded = useMapStore((s) => s.loaded);
  useEffect(() => {
    if (!mapLoaded || completedRooms.length > 0) return;
    loadFromMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded]);

  const snapLabel = snapMode === 'meter' ? '1 m'
                  : snapMode === 'decimeter' ? '0,1 m'
                  : '0,01 m';

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const data = toMapDocument(completedRooms, completedWalls, spawnPoint) as unknown as Record<string, unknown>;
      if (savedId) {
        await putObject('floor_plans', savedId, data, {}, 'VirtualOffice', true);
      } else {
        const doc = await createObject('floor_plans', data, {}, 'VirtualOffice', true);
        setSavedId(doc._id);
      }
      useMapStore.getState().setMap(completedRooms, completedWalls, spawnPoint);
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

  const handleDownloadJson = () => {
    const data = JSON.stringify(toMapDocument(completedRooms, completedWalls, spawnPoint), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'floor_plan.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as MapDocument | {
          rooms?: Room[]; walls?: Wall[]; spawnPoint?: [number, number];
        };
        if ('points' in parsed && parsed.points && Array.isArray(parsed.walls) && Array.isArray(parsed.rooms)) {
          // Neues Format
          const { rooms, walls, spawnPoint: sp } = parseMapDocument(parsed as MapDocument);
          importData(rooms, walls, sp);
        } else if ('rooms' in parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.walls)) {
          // Altes Format
          const sp = 'spawnPoint' in parsed && Array.isArray(parsed.spawnPoint)
            ? parsed.spawnPoint as [number, number] : undefined;
          importData(parsed.rooms as Room[], parsed.walls as Wall[], sp);
        } else {
          alert('Ungültiges Format.');
        }
      } catch { alert('Fehler beim Lesen der Datei.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openEditRoom = (i: number) => {
    setEditingRoomIdx(i);
    setEditLabel(completedRooms[i].label);
    setEditFill(completedRooms[i].fill);
  };

  const confirmEditRoom = () => {
    if (editingRoomIdx === null || !editLabel.trim()) return;
    renameRoom(editingRoomIdx, editLabel.trim(), editFill);
    setEditingRoomIdx(null);
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
            <div
              key={i}
              style={{ ...roomRow, cursor: 'pointer' }}
              onClick={() => openEditRoom(i)}
              title="Klicken zum Bearbeiten"
            >
              <div style={{
                width: 16, height: 16, flexShrink: 0,
                background: room.fill, borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.1)',
              }} />
              <span style={{ color: '#e2e8f0', fontSize: 13, flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room.label}
              </span>
              <button
                style={delBtn}
                onClick={(e) => { e.stopPropagation(); deleteRoom(i); }}
                title="Raum löschen"
              >✕</button>
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
              style={{ ...actionBtn, color: '#a78bfa' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(167,139,250,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={handleDownloadJson}
            >
              ⬇️ Als JSON herunterladen
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
        {/* Upload-Button immer sichtbar */}
        <button
          style={{ ...actionBtn, color: '#fbbf24' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          onClick={() => fileInputRef.current?.click()}
        >
          ⬆️ JSON-Datei importieren
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>

      {/* Raum-Bearbeitungs-Modal */}
      {editingRoomIdx !== null && (
        <div style={exportModal} onMouseDown={() => setEditingRoomIdx(null)}>
          <div
            style={{ ...exportCard, maxWidth: 400, gap: 10 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Raum bearbeiten</div>

            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 2 }}>Raumname</div>
            <input
              autoFocus
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEditRoom(); if (e.key === 'Escape') setEditingRoomIdx(null); }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1e293b', border: '1px solid rgba(99,179,237,0.25)',
                borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14,
                outline: 'none', marginBottom: 10,
              }}
              placeholder="z. B. Büro A"
            />

            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Bodenfarbe</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setEditFill(c.value)}
                  style={{
                    width: '100%', aspectRatio: '1', background: c.value,
                    border: editFill === c.value ? '2px solid #60a5fa' : '2px solid transparent',
                    borderRadius: 6, cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input
                type="color"
                value={editFill}
                onChange={(e) => setEditFill(e.target.value)}
                style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
              />
              <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{editFill}</span>
              <div style={{ width: 36, height: 24, background: editFill, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1px solid rgba(99,179,237,0.2)', borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
                onClick={() => setEditingRoomIdx(null)}
              >
                Abbrechen
              </button>
              <button
                style={{ flex: 1, padding: '9px 0', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: editLabel.trim() ? 1 : 0.4 }}
                onClick={confirmEditRoom}
                disabled={!editLabel.trim()}
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

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
