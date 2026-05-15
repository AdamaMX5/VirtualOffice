import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useProfileStore } from '../../model/stores/profileStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { useAuthStore } from '../../model/stores/authStore';
import { loadProfile, saveProfile } from '../../services/profileClient';
import { uploadMedia } from '../../services/objectClient';
import { presenceSend } from '../../hooks/usePresence';
import { fetchEvents, groupByDay, formatEventTime, isCurrentlyBusy } from '../../services/calendarClient';
import type { CalEvent } from '../../services/calendarClient';

// ── Crop-Konstanten ───────────────────────────────────────────────────────────
const PREVIEW  = 200;
const RADIUS   = 88;
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
    width: 460,
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,179,237,0.05)',
    overflowY: 'auto' as const,
  },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },

  title: { color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: 0 },

  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#64748b', fontSize: 20, lineHeight: 1, padding: '2px 6px', borderRadius: 6,
  },

  avatarWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 },

  avatarCircle: {
    width: 80, height: 80, borderRadius: '50%',
    background: '#1e293b', border: '2px solid #facc15',
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

  divider: {
    borderTop: '1px solid rgba(99,179,237,0.12)', margin: '4px 0',
  },

  sectionTitle: {
    color: '#60a5fa', fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6,
  },

  calRow: { display: 'flex', gap: 8, alignItems: 'center' },

  calLoadBtn: {
    flexShrink: 0, background: '#1e293b', border: '1px solid rgba(99,179,237,0.3)',
    borderRadius: 8, padding: '10px 14px', color: '#60a5fa',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },

  calHint: { color: '#475569', fontSize: 11, lineHeight: 1.4 },

  dayLabel: { color: '#60a5fa', fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 4 },

  eventCard: {
    background: '#1e293b',
    border: '1px solid rgba(99,179,237,0.15)',
    borderRadius: 8, padding: '8px 12px',
    display: 'flex', flexDirection: 'column' as const, gap: 2,
  },

  eventTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 },
  eventTime: { color: '#60a5fa', fontSize: 11 },
  eventLoc:  { color: '#64748b', fontSize: 11 },

  eventCurrent: {
    background: '#1a2e1a',
    border: '1px solid rgba(34,197,94,0.35)',
  },

  calError: { color: '#f87171', fontSize: 12 },
  calEmpty: { color: '#64748b', fontSize: 13 },

  busyDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
    display: 'inline-block', marginLeft: 4,
  },

  busyDotRed: {
    width: 8, height: 8, borderRadius: '50%', background: '#f87171',
    display: 'inline-block', marginLeft: 4,
  },

  saveBtn: {
    background: '#2563eb', border: 'none', borderRadius: 8,
    padding: '11px 0', color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', width: '100%', marginTop: 4,
  },

  error: { color: '#f87171', fontSize: 13, textAlign: 'center' as const },

  // Crop
  cropSection: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 },
  cropCanvas:  { borderRadius: 12, cursor: 'grab', display: 'block', border: '1px solid rgba(99,179,237,0.3)' },
  cropHint:    { color: '#64748b', fontSize: 12, textAlign: 'center' as const },
  cropRow:     { display: 'flex', gap: 10, width: '100%' },
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
  return { scale, offset: { x: PREVIEW / 2 - (img.width * scale) / 2, y: PREVIEW / 2 - (img.height * scale) / 2 } };
}

function clampOffset(ox: number, oy: number, scale: number, img: HTMLImageElement) {
  return {
    x: clamp(ox, PREVIEW / 2 + RADIUS - img.width  * scale, PREVIEW / 2 - RADIUS),
    y: clamp(oy, PREVIEW / 2 + RADIUS - img.height * scale, PREVIEW / 2 - RADIUS),
  };
}

function drawCrop(canvas: HTMLCanvasElement, img: HTMLImageElement, scale: number, offset: { x: number; y: number }) {
  const ctx = canvas.getContext('2d')!;
  const cx = PREVIEW / 2, cy = PREVIEW / 2;
  ctx.clearRect(0, 0, PREVIEW, PREVIEW);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, PREVIEW, PREVIEW);
  ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
  const outer = new Path2D();
  outer.rect(0, 0, PREVIEW, PREVIEW);
  outer.arc(cx, cy, RADIUS, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill(outer, 'evenodd');
  ctx.beginPath();
  ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.stroke();
}

async function cropToBlob(img: HTMLImageElement, scale: number, offset: { x: number; y: number }): Promise<Blob> {
  const off = document.createElement('canvas');
  off.width = off.height = OUT_SIZE;
  const ctx = off.getContext('2d')!;
  const srcR = RADIUS / scale;
  const srcCx = (PREVIEW / 2 - offset.x) / scale;
  const srcCy = (PREVIEW / 2 - offset.y) / scale;
  ctx.beginPath();
  ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, srcCx - srcR, srcCy - srcR, srcR * 2, srcR * 2, 0, 0, OUT_SIZE, OUT_SIZE);
  return new Promise((resolve, reject) => {
    off.toBlob((b) => b ? resolve(b) : reject(new Error('Blob leer')), 'image/png');
  });
}

// ── Event-Anzeige ─────────────────────────────────────────────────────────────

function EventList({ events }: { events: CalEvent[] }) {
  const groups = groupByDay(events);
  if (groups.length === 0) return <p style={S.calEmpty}>Keine Termine in den nächsten 14 Tagen.</p>;
  return (
    <>
      {groups.map((g) => (
        <div key={g.label}>
          <div style={S.dayLabel}>{g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.events.map((ev, i) => {
              const now = new Date();
              const isCurrent = new Date(ev.start) <= now && now < new Date(ev.end);
              return (
                <div key={i} style={{ ...S.eventCard, ...(isCurrent ? S.eventCurrent : {}) }}>
                  <span style={S.eventTitle}>{ev.summary}</span>
                  <span style={{ ...S.eventTime, color: isCurrent ? '#22c55e' : '#60a5fa' }}>
                    {formatEventTime(ev)}
                  </span>
                  {ev.location && <span style={S.eventLoc}>📍 {ev.location}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

const ProfileModal = () => {
  const isOpen       = useProfileStore((s) => s.isOpen);
  const close        = useProfileStore((s) => s.close);
  const setAvatarUrl = useProfileStore((s) => s.setAvatarUrl);
  const setName      = usePlayerStore((s) => s.setName);
  const userId       = useAuthStore((s) => s.userId);

  // Profil-Felder
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [department,  setDepartment]  = useState('');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  // Kalender-State
  const [events,    setEvents]    = useState<CalEvent[] | null>(null);
  const [calError,  setCalError]  = useState<string | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  // Crop-State
  const [cropMode,    setCropMode]    = useState(false);
  const [cropImg,     setCropImg]     = useState<HTMLImageElement | null>(null);
  const [cropScale,   setCropScale]   = useState(1);
  const [cropOffset,  setCropOffset]  = useState({ x: 0, y: 0 });
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const dragging  = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  // Profil beim Öffnen laden
  useEffect(() => {
    if (!isOpen || !userId) return;
    setError(null);
    setEvents(null);
    setCalError(null);
    setCropMode(false);
    setCroppedBlob(null);
    loadProfile(userId).then((res) => {
      if (!res) return;
      setFirstName(res.profile.firstName   ?? '');
      setLastName(res.profile.lastName     ?? '');
      setDepartment(res.profile.department ?? '');
      setCalendarUrl(res.profile.calendarUrl ?? '');
      if (res.profile.avatarUrl) setPreviewUrl(res.profile.avatarUrl);
      if (res.profile.calendarUrl) loadCalendar(res.profile.calendarUrl);
    });
  }, [isOpen, userId]);

  // Crop-Canvas zeichnen
  useEffect(() => {
    if (!cropMode || !cropImg || !canvasRef.current) return;
    drawCrop(canvasRef.current, cropImg, cropScale, cropOffset);
  }, [cropMode, cropImg, cropScale, cropOffset]);

  // Kalender laden
  const loadCalendar = useCallback(async (url?: string) => {
    const targetUrl = url ?? calendarUrl;
    if (!targetUrl.trim()) return;
    setCalLoading(true);
    setCalError(null);
    try {
      const evs = await fetchEvents(targetUrl.trim());
      setEvents(evs);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : 'Kalender-Fehler');
      setEvents(null);
    } finally {
      setCalLoading(false);
    }
  }, [calendarUrl]);

  // Crop-Events
  const onCropMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
    e.preventDefault();
  }, [cropOffset]);

  const onCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !cropImg) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setCropOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, cropScale, cropImg));
  }, [cropScale, cropImg]);

  const onCropMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onCropWheel = useCallback((e: React.WheelEvent) => {
    if (!cropImg) return;
    e.preventDefault();
    const minScale = Math.max((RADIUS * 2) / cropImg.width, (RADIUS * 2) / cropImg.height);
    const newScale = clamp(cropScale * (e.deltaY < 0 ? 1.1 : 0.9), minScale, minScale * 6);
    const newOx = PREVIEW / 2 - ((PREVIEW / 2 - cropOffset.x) / cropScale) * newScale;
    const newOy = PREVIEW / 2 - ((PREVIEW / 2 - cropOffset.y) / cropScale) * newScale;
    setCropScale(newScale);
    setCropOffset(clampOffset(newOx, newOy, newScale, cropImg));
  }, [cropScale, cropOffset, cropImg]);

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
      const profile = { firstName, lastName, department, avatarUrl, calendarUrl: calendarUrl.trim() };
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

  const busy = events ? isCurrentlyBusy(events) : false;

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
              <button style={S.cropBtn(false)} onClick={() => { setCropMode(false); setCropImg(null); }}>Abbrechen</button>
              <button style={S.cropBtn(true)} onClick={confirmCrop}>Übernehmen</button>
            </div>
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div style={S.avatarWrap}>
              <div style={S.avatarCircle}>
                {previewUrl
                  ? <img src={previewUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 36 }}>🙂</span>
                }
              </div>
              <button style={S.changeBtn} onClick={() => fileRef.current?.click()}>Bild ändern</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </div>

            {/* Name + Abteilung */}
            <div>
              <div style={S.label}>Vorname</div>
              <input style={S.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Vorname" autoFocus />
            </div>
            <div>
              <div style={S.label}>Nachname</div>
              <input style={S.input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nachname" />
            </div>
            <div>
              <div style={S.label}>Abteilung</div>
              <input style={S.input} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="z.B. Entwicklung" />
            </div>

            <div style={S.divider} />

            {/* Kalender */}
            <div>
              <div style={{ ...S.sectionTitle, marginBottom: 10 }}>
                📅 Kalender
                {events && (
                  <span style={busy ? S.busyDotRed : S.busyDot} title={busy ? 'Aktuell beschäftigt' : 'Frei'} />
                )}
              </div>
              <div style={{ ...S.label, marginBottom: 6 }}>
                iCal-URL (iOS Kalender, Google Calendar, Outlook)
              </div>
              <div style={S.calRow}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={calendarUrl}
                  onChange={(e) => setCalendarUrl(e.target.value)}
                  placeholder="webcal://... oder https://..."
                />
                <button
                  style={{ ...S.calLoadBtn, opacity: calLoading ? 0.6 : 1 }}
                  onClick={() => loadCalendar()}
                  disabled={calLoading || !calendarUrl.trim()}
                >
                  {calLoading ? '…' : 'Laden'}
                </button>
              </div>
              <p style={{ ...S.calHint, marginTop: 6 }}>
                iOS: Einstellungen → Kalender → Accounts → Kalender freigeben → Link kopieren<br />
                Google: Kalender-Einstellungen → „Geheime Adresse im iCal-Format"<br />
                Outlook: Kalender veröffentlichen → ICS-Link kopieren
              </p>
              {calError && <p style={{ ...S.calError, marginTop: 6 }}>{calError}</p>}
              {events !== null && (
                <div style={{ marginTop: 10 }}>
                  <EventList events={events} />
                </div>
              )}
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
