/**
 * FurniturePanel – rechte Sidebar für den Möbelkatalog.
 *
 * Features:
 * - Katalog nach Gruppen gegliedert (Tabs)
 * - Klick auf Kachel → Möbel zum Platzieren vormerken
 * - PNG hochladen + Metadaten eingeben → in MediaService + ObjectService speichern
 * - Ausgewähltes Möbel auf der Karte: Löschen-Button
 */
import React, { useRef, useState, useCallback } from 'react';
import { useFurnitureStore, CatalogItem } from '../../model/stores/furnitureStore';
import { useAuthStore } from '../../model/stores/authStore';
import { getJwtUserId } from '../../services/objectClient';
import { uploadCatalogItem, deleteItem, deleteCatalogItem } from '../../services/furnitureService';

const PRESET_GROUPS = ['Arbeitsplätze', 'Sitzgelegenheiten', 'Boards', 'Dekoration', 'Sonstiges'];
const PRESET_TYPES  = [
  { value: 'desk',       label: 'Schreibtisch' },
  { value: 'todo_board', label: 'Todo-Board' },
  { value: 'chair',      label: 'Sessel' },
  { value: 'decoration', label: 'Dekoration' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 280,
  zIndex: 300,
  background: 'rgba(10,10,15,0.96)',
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  flexDirection: 'column',
  color: '#fff',
  fontFamily: 'inherit',
};

const header: React.CSSProperties = {
  padding: '14px 16px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)',
  padding: '8px 16px 4px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  padding: '4px 12px 12px',
};

const tileStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.05)',
  border: `1px solid ${active ? 'rgba(99,179,237,0.7)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: 8,
  padding: 6,
  cursor: 'pointer',
  textAlign: 'center',
  fontSize: 10,
  color: 'rgba(255,255,255,0.7)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  transition: 'border-color 0.15s, background 0.15s',
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  padding: '6px 10px',
  color: '#fff',
  fontSize: 12,
  boxSizing: 'border-box',
};

const btnStyle = (color = 'rgba(79,142,247,0.8)'): React.CSSProperties => ({
  background: color,
  border: 'none',
  borderRadius: 6,
  padding: '7px 0',
  color: '#fff',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  width: '100%',
});

// ── Upload-Formular ───────────────────────────────────────────────────────────

const UploadForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,    setFile]    = useState<File | null>(null);
  const [name,    setName]    = useState('');
  const [type,    setType]    = useState('decoration');
  const [group,   setGroup]   = useState('Sonstiges');
  const [customG, setCustomG] = useState('');
  const [w,       setW]       = useState(2);
  const [h,       setH]       = useState(2);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  const effectiveGroup = customG.trim() || group;

  const handleSubmit = useCallback(async () => {
    if (!file || !name.trim()) { setError('Datei und Name sind Pflicht'); return; }
    setBusy(true);
    setError('');
    try {
      await uploadCatalogItem(file, name.trim(), type, effectiveGroup, w, h);
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [file, name, type, effectiveGroup, w, h, onDone]);

  return (
    <div style={{ padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Datei-Auswahl */}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
      />
      <button style={btnStyle('rgba(255,255,255,0.1)')} onClick={() => fileRef.current?.click()}>
        {file ? `📎 ${file.name}` : '📎 PNG auswählen'}
      </button>

      {/* Name */}
      <input style={inputStyle} placeholder="Name *" value={name}
        onChange={(e) => setName(e.target.value)} />

      {/* Typ */}
      <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
        {PRESET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Gruppe: Preset + manuell */}
      <select style={inputStyle} value={group} onChange={(e) => setGroup(e.target.value)}>
        {PRESET_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <input style={inputStyle} placeholder="Eigene Gruppe (optional)" value={customG}
        onChange={(e) => setCustomG(e.target.value)} />

      {/* Standardgröße */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Breite (Tiles)</label>
          <input style={inputStyle} type="number" min={0.5} max={20} step={0.5}
            value={w} onChange={(e) => setW(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Höhe (Tiles)</label>
          <input style={inputStyle} type="number" min={0.5} max={20} step={0.5}
            value={h} onChange={(e) => setH(Number(e.target.value))} />
        </div>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
      <button style={btnStyle(busy ? 'rgba(79,142,247,0.4)' : undefined)}
        onClick={handleSubmit} disabled={busy}>
        {busy ? 'Lädt hoch...' : '⬆ Hochladen'}
      </button>
      <button style={btnStyle('rgba(255,255,255,0.06)')} onClick={onDone}>
        Abbrechen
      </button>
    </div>
  );
};

// ── Hauptpanel ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

const FurniturePanel: React.FC<Props> = ({ onClose }) => {
  const { catalogItems, pendingCatalogItem, selectedId, placedItems,
          setPendingCatalogItem, selectItem } = useFurnitureStore();
  const authStatus = useAuthStore((s) => s.authStatus);
  const isAuth     = authStatus === 'connected_auth';
  const ownerId    = getJwtUserId();

  const [activeGroup, setActiveGroup] = useState<string>('Alle');
  const [showUpload,  setShowUpload]  = useState(false);

  // Alle vorhandenen Gruppen aus dem Katalog + Presets
  const groups = ['Alle', ...Array.from(new Set([
    ...PRESET_GROUPS,
    ...catalogItems.map((i) => i.group),
  ]))];

  const filtered = activeGroup === 'Alle'
    ? catalogItems
    : catalogItems.filter((i) => i.group === activeGroup);

  const selectedPlaced = selectedId ? placedItems.find((i) => i.id === selectedId) : null;
  const canDeleteSelected = selectedPlaced &&
    (selectedPlaced.ownerId === ownerId /* admin check via store */);

  const handleSelectCatalog = (item: CatalogItem) => {
    if (!isAuth) return;
    setPendingCatalogItem(pendingCatalogItem?.id === item.id ? null : item);
  };

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    await deleteItem(selectedId);
    selectItem(null);
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🪑 Möbelkatalog</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}>✕</button>
      </div>

      {!isAuth && (
        <div style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          Einloggen um Möbel zu platzieren.
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Auswahl-Info */}
        {pendingCatalogItem && (
          <div style={{
            margin: '8px 12px', padding: '8px 12px',
            background: 'rgba(79,142,247,0.15)',
            border: '1px solid rgba(99,179,237,0.5)',
            borderRadius: 8, fontSize: 12,
          }}>
            <b>{pendingCatalogItem.name}</b> auswählen → auf Karte klicken um zu platzieren.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>ESC zum Abbrechen</span>
          </div>
        )}

        {/* Ausgewähltes Möbel auf der Karte */}
        {selectedPlaced && (
          <div style={{
            margin: '8px 12px', padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, fontSize: 12,
          }}>
            <div style={{ marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
              Ausgewählt: <b style={{ color: '#fff' }}>{selectedPlaced.type}</b>
              <span style={{ marginLeft: 8, opacity: 0.4 }}>
                {selectedPlaced.width.toFixed(1)}×{selectedPlaced.height.toFixed(1)} Tiles · {Math.round(selectedPlaced.rotation)}°
              </span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 8 }}>
              Scrollen mit 🖱 gedrückt = Größe ändern · Rotationsgriff = drehen
            </div>
            <button
              style={btnStyle('rgba(239,68,68,0.75)')}
              onClick={handleDeleteSelected}
            >
              🗑 Möbel entfernen
            </button>
          </div>
        )}

        {/* Upload-Formular */}
        {showUpload ? (
          <>
            <div style={sectionTitle}>PNG hochladen</div>
            <UploadForm onDone={() => setShowUpload(false)} />
          </>
        ) : (
          isAuth && (
            <div style={{ padding: '8px 12px 4px' }}>
              <button style={btnStyle('rgba(255,255,255,0.08)')}
                onClick={() => setShowUpload(true)}>
                ➕ Neues Möbel hochladen
              </button>
            </div>
          )
        )}

        {/* Gruppen-Tabs */}
        {!showUpload && (
          <>
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap',
              padding: '8px 12px 4px',
            }}>
              {groups.map((g) => (
                <button key={g} onClick={() => setActiveGroup(g)} style={{
                  background: activeGroup === g ? 'rgba(79,142,247,0.3)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${activeGroup === g ? 'rgba(99,179,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12,
                  padding: '3px 10px',
                  color: '#fff',
                  fontSize: 11,
                  cursor: 'pointer',
                }}>
                  {g}
                </button>
              ))}
            </div>

            {/* Katalog-Grid */}
            <div style={sectionTitle}>
              {activeGroup} ({filtered.length})
            </div>
            <div style={gridStyle}>
              {filtered.map((item) => (
                <div key={item.id}
                  style={tileStyle(pendingCatalogItem?.id === item.id)}
                  onClick={() => handleSelectCatalog(item)}
                  title={`${item.name} · ${item.type}`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', borderRadius: 4 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {item.name}
                  </span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1/-1', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '8px 0' }}>
                  Noch keine Möbel in dieser Gruppe.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FurniturePanel;
