import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useProfileStore } from '../../model/stores/profileStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { useAuthStore } from '../../model/stores/authStore';
import { loadProfile, saveProfile } from '../../services/profileClient';
import { uploadMedia } from '../../services/objectClient';
import { presenceSend } from '../../hooks/usePresence';

// ── Crop-Konstanten ───────────────────────────────────────────────────────────
const PREVIEW = 200;
const RADIUS  = 88;
const OUT_SIZE = 256;

// ── Stile ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.80)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  } as React.CSSProperties,

  card: {
    background: '#0f172a',
    border: '1px solid rgba(99,179,237,0.2)',
    borderRadius: 16,
    padding: 28,
    width: 420,
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,179,237,0.05)',
    overflowY: 'auto' as const,
  },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },

  title: { color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: 0 },

  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#64748b', fontSize: 20, lineHeight: 1, padding: '2px 6px',
    borderRadius: 6,
  },

  avatarWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 },

  avatarCircle: {
    width: 80, height: 80, borderRadius: '50%',
    background: '#1e293b',
    border: '2px solid #facc15',
    overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  changeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#60a5fa', fontSize: 13, textDecoration: 'underline', padding: 0,
  },

  label: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },

  input: {
    width: '100%', boxSizing: 'border-box' as const,
    background: '#1e293b', border: '1px solid rgba(99,179,237,0.25)',
    borderRadius: 8, padding: '10px 12px',
    color: '#e2e8f0', fontSize: 14, outline: 'none',
  },

  saveBtn: {
    background: '#2563eb', border: 'none', borderRadius: 8,
    padding: '11px 0', color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', width: '100%', marginTop: 4,
  },

  error: { color: '#f87171', fontSize: 13, textAlign: 'center' as const },

  // Crop-spezifisch
  cropSection: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 },

  cropCanvas: {
    borderRadius: 12, cursor: 'grab', display: 'block',
    border: '1px solid rgba(99,179,237,0.3)',
  },

  cropHint: { color: '#64748b', fontSize: 12, textAlign: 'center' as const },

  cropRow: { display: 'flex', gap: 10, width: '100%' },

  cropBtn: (primary: boolean): React.CSSProperties => ({
    flex: 1, border: 'none', borderRadius: 8, padding: '10px 0',
    cursor: 'pointer', fontWeight: 600, fontSize: 14,
    background: primary ? '#2563eb' : '#1e293b',
    color: primary ? '#fff' : '#94a3b8',
  }),
};

// ── Crop-Logik ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function initCrop(img: HTMLImageElement) {
  const scale = Math.max((RADIUS * 2) / img.width, (RADIUS * 2) / img.height);
  return {
    scale,
    offset: {
      x: PREVIEW / 2 - (img.width  * scale) / 2,
      y: PREVIEW / 2 - (img.height * scale) / 2,
    },
  };
}

function clampOffset(ox: number, oy: number, scale: number, img: HTMLImageElement) {
  const maxOx = PREVIEW / 2 - RADIUS;
  const minOx = PREVIEW / 2 + RADIUS - img.width  * scale;
  const maxOy = PREVIEW / 2 - RADIUS;
  const minOy = PREVIEW / 2 + RADIUS - img.height * scale;
  return { x: clamp(ox, minOx, maxOx), y: clamp(oy, minOy, maxOy) };
}

function drawCrop(canvas: HTMLCanvasElement, img: HTMLImageElement, scale: number, offset: { x: number; y: number }) {
  const ctx = canvas.getContext('2d')!;
  const cx = PREVIEW / 2, cy = PREVIEW / 2;

  ctx.clearRect(0, 0, PREVIEW, PREVIEW);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, PREVIEW, PREVIEW);

  ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);

  // Außenbereich abdunkeln
  const outer = new Path2D();
  outer.rect(0, 0, PREVIEW, PREVIEW);
  outer.arc(cx, cy, RADIUS, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill(outer, 'evenodd');

  // Kreis-Rand
  ctx.beginPath();
  ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.stroke();
}

async function cropToBlob(img: HTMLImageElement, scale: number, offset: { x: number; y: number }): Promise<Blob> {
  const offscreen = document.createElement('canvas');
  offscreen.width  = OUT_SIZE;
  offscreen.height = OUT_SIZE;
  const ctx = offscreen.getContext('2d')!;

  // Quelle: Region in Bildpixeln, die dem Crop-Kreis entspricht
  const srcRadius = RADIUS / scale;
  const srcCx = (PREVIEW / 2 - offset.x) / scale;
  const srcCy = (PREVIEW / 2 - offset.y) / scale;

  ctx.beginPath();
  ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(
    img,
    srcCx - srcRadius, srcCy - srcRadius, srcRadius * 2, srcRadius * 2,
    0, 0, OUT_SIZE, OUT_SIZE,
  );

  return new Promise((resolve, reject) => {
    offscreen.toBlob((b) => b ? resolve(b) : reject(new Error('Blob leer')), 'image/png');
  });
}

// ── Komponente ────────────────────────────────────────────────────────────────

const ProfileModal = () => {
  const isOpen   = useProfileStore((s) => s.isOpen);
  const close    = useProfileStore((s) => s.close);
  const setAvatarUrl = useProfileStore((s) => s.setAvatarUrl);
  const setName  = usePlayerStore((s) => s.setName);
  const userId   = useAuthStore((s) => s.userId);

  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [department, setDepartment] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [docId,      setDocId]      = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Crop-State
  const [cropMode,   setCropMode]   = useState(false);
  const [cropImg,    setCropImg]    = useState<HTMLImageElement | null>(null);
  const [cropScale,  setCropScale]  = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  // Profil beim Öffnen laden
  useEffect(() => {
    if (!isOpen || !userId) return;
    setError(null);
    setCropMode(false);
    setCroppedBlob(null);
    loadProfile(userId).then((res) => {
      if (!res) { setDocId(null); return; }
      setDocId(res.id);
      setFirstName(res.profile.firstName  ?? '');
      setLastName(res.profile.lastName    ?? '');
      setDepartment(res.profile.department ?? '');
      if (res.profile.avatarUrl) setPreviewUrl(res.profile.avatarUrl);
    });
  }, [isOpen, userId]);

  // Crop-Canvas neu zeichnen wenn sich Offset/Scale/Bild ändern
  useEffect(() => {
    if (!cropMode || !cropImg || !canvasRef.current) return;
    drawCrop(canvasRef.current, cropImg, cropScale, cropOffset);
  }, [cropMode, cropImg, cropScale, cropOffset]);

  // Crop-Maus-Events
  const onCropMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
    e.preventDefault();
  }, [cropOffset]);

  const onCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !cropImg) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const clamped = clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, cropScale, cropImg);
    setCropOffset(clamped);
  }, [cropScale, cropImg]);

  const onCropMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onCropWheel = useCallback((e: React.WheelEvent) => {
    if (!cropImg) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const minScale = Math.max((RADIUS * 2) / cropImg.width, (RADIUS * 2) / cropImg.height);
    const newScale = clamp(cropScale * factor, minScale, minScale * 6);
    // Zoom zur Mitte
    const newOx = PREVIEW / 2 - ((PREVIEW / 2 - cropOffset.x) / cropScale) * newScale;
    const newOy = PREVIEW / 2 - ((PREVIEW / 2 - cropOffset.y) / cropScale) * newScale;
    const clamped = clampOffset(newOx, newOy, newScale, cropImg);
    setCropScale(newScale);
    setCropOffset(clamped);
  }, [cropScale, cropOffset, cropImg]);

  // Datei ausgewählt
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { scale, offset } = initCrop(img);
      setCropImg(img);
      setCropScale(scale);
      setCropOffset(offset);
      setCropMode(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
  };

  // Zuschnitt bestätigen
  const confirmCrop = async () => {
    if (!cropImg) return;
    const blob = await cropToBlob(cropImg, cropScale, cropOffset);
    setCroppedBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setCropMode(false);
    setCropImg(null);
  };

  // Speichern
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let avatarUrl = previewUrl ?? '';

      if (croppedBlob) {
        const file = new File([croppedBlob], 'avatar.png', { type: 'image/png' });
        const { url } = await uploadMedia(file, 'VirtualOffice', 'avatars');
        avatarUrl = url;
      }

      const profile = { firstName, lastName, department, avatarUrl };
      await saveProfile(profile);

      const displayName = [firstName, lastName].filter(Boolean).join(' ') || (useAuthStore.getState().email ?? '');
      setName(displayName);
      presenceSend({ type: 'set_name', name: displayName, department: department || undefined });
      setAvatarUrl(avatarUrl || null);

      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>{cropMode ? 'Bild zuschneiden' : 'Profil bearbeiten'}</h2>
          <button style={S.closeBtn} onClick={close} title="Schließen">✕</button>
        </div>

        {cropMode ? (
          /* ── Crop-Ansicht ── */
          <div style={S.cropSection}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              style={S.cropCanvas}
              onMouseDown={onCropMouseDown}
              onMouseMove={onCropMouseMove}
              onMouseUp={onCropMouseUp}
              onMouseLeave={onCropMouseUp}
              onWheel={onCropWheel}
            />
            <p style={S.cropHint}>Ziehen zum Verschieben · Scrollrad zum Zoomen</p>
            <div style={S.cropRow}>
              <button style={S.cropBtn(false)} onClick={() => { setCropMode(false); setCropImg(null); }}>
                Abbrechen
              </button>
              <button style={S.cropBtn(true)} onClick={confirmCrop}>
                Übernehmen
              </button>
            </div>
          </div>
        ) : (
          /* ── Profil-Formular ── */
          <>
            {/* Avatar-Vorschau */}
            <div style={S.avatarWrap}>
              <div style={S.avatarCircle}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 36 }}>🙂</span>
                )}
              </div>
              <button style={S.changeBtn} onClick={() => fileRef.current?.click()}>
                Bild ändern
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </div>

            {/* Formularfelder */}
            <div>
              <div style={S.label}>Vorname</div>
              <input
                style={S.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Vorname"
                autoFocus
              />
            </div>
            <div>
              <div style={S.label}>Nachname</div>
              <input
                style={S.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
              />
            </div>
            <div>
              <div style={S.label}>Abteilung</div>
              <input
                style={S.input}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="z.B. Entwicklung"
              />
            </div>

            {error && <p style={S.error}>{error}</p>}

            <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
