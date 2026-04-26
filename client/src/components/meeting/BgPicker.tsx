import React, { useEffect, useRef, useState, useCallback } from 'react';
import { browseMedia, deleteMedia, type MediaFile } from '../../services/objectClient';
import { uploadAndSaveMeetingBg, selectMeetingBg, clearMeetingBg } from '../../services/meetingService';
import { presenceSend } from '../../hooks/usePresence';

interface Props {
  currentUrl: string | null;
  onClose: () => void;
}

const TILE_W = 148;
const TILE_H = Math.round(TILE_W * 9 / 16); // 16:9

const BgPicker: React.FC<Props> = ({ currentUrl, onClose }) => {
  const [images, setImages]     = useState<MediaFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const reload = useCallback(() =>
    browseMedia('VirtualOffice', 'meeting_backgrounds')
      .then(setImages)
      .finally(() => setLoading(false)),
  []);

  useEffect(() => { reload(); }, [reload]);

  const handleSelect = useCallback(async (img: MediaFile) => {
    if (img.url === currentUrl) { onClose(); return; }
    await selectMeetingBg(img.url);
    presenceSend({ type: 'meeting_bg', backgroundUrl: img.url });
    onClose();
  }, [currentUrl, onClose]);

  const handleDelete = useCallback(async (img: MediaFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(img.id);
    try {
      await deleteMedia(img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      if (currentUrl === img.url) {
        await clearMeetingBg();
        presenceSend({ type: 'meeting_bg', backgroundUrl: null });
      }
    } finally {
      setDeleting(null);
    }
  }, [currentUrl]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const url = await uploadAndSaveMeetingBg(file);
      presenceSend({ type: 'meeting_bg', backgroundUrl: url });
      await reload();
      onClose();
    } catch (err) {
      console.error('[BgPicker] Upload fehlgeschlagen:', err);
    } finally {
      setUploading(false);
    }
  }, [reload, onClose]);

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(15,15,22,0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: 20,
          width: Math.min(window.innerWidth - 32, 660),
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            🖼 Hintergrundbild wählen
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Grid */}
        <div style={{
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          paddingRight: 4,
        }}>
          {/* Upload-Kachel */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: TILE_W, height: TILE_H,
              borderRadius: 8,
              border: '2px dashed rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.5)',
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, fontSize: 11, flexShrink: 0,
            }}
          >
            {uploading ? <>⏳<br/>Lädt...</> : <><span style={{ fontSize: 20 }}>＋</span>Neues Bild</>}
          </button>

          {/* "Kein Hintergrund"-Kachel */}
          <div
            onClick={async () => { await clearMeetingBg(); presenceSend({ type: 'meeting_bg', backgroundUrl: null }); onClose(); }}
            style={{
              width: TILE_W, height: TILE_H,
              borderRadius: 8,
              border: currentUrl === null
                ? '2px solid #4f8ef7'
                : '2px solid rgba(255,255,255,0.1)',
              background: '#0a0a0f',
              color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, flexShrink: 0,
            }}
          >
            Kein Hintergrund
          </div>

          {loading && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, alignSelf: 'center' }}>
              Lädt...
            </div>
          )}

          {/* Bild-Kacheln */}
          {images.map((img) => {
            const isActive  = img.url === currentUrl;
            const isHovered = hovered === img.id;
            const isDeleting = deleting === img.id;
            return (
              <div
                key={img.id}
                onClick={() => handleSelect(img)}
                onMouseEnter={() => setHovered(img.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'relative',
                  width: TILE_W, height: TILE_H,
                  borderRadius: 8,
                  border: isActive
                    ? '2px solid #4f8ef7'
                    : isHovered ? '2px solid rgba(255,255,255,0.35)' : '2px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: isDeleting ? 0.4 : 1,
                  transition: 'border-color 0.15s, opacity 0.15s',
                }}
              >
                <img
                  src={img.url}
                  alt={img.name ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Aktiv-Badge */}
                {isActive && (
                  <div style={{
                    position: 'absolute', bottom: 4, left: 4,
                    background: '#4f8ef7', borderRadius: 4,
                    fontSize: 9, fontWeight: 700, color: '#fff',
                    padding: '1px 5px',
                  }}>Aktiv</div>
                )}
                {/* Löschen-Button */}
                {isHovered && !isDeleting && (
                  <button
                    onClick={(e) => handleDelete(img, e)}
                    title="Bild löschen"
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      background: 'rgba(239,68,68,0.85)',
                      border: 'none', borderRadius: 4,
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', padding: '2px 6px',
                      lineHeight: 1.4,
                    }}
                  >✕</button>
                )}
              </div>
            );
          })}

          {!loading && images.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, alignSelf: 'center' }}>
              Noch keine Bilder hochgeladen
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>
    </div>
  );
};

export default BgPicker;
