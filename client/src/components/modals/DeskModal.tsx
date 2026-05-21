import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDeskStore, DeskNote } from '../../model/stores/deskStore';
import { useAuthStore } from '../../model/stores/authStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { useFurnitureStore } from '../../model/stores/furnitureStore';
import { useMessageStore } from '../../model/stores/messageStore';
import { getJwtUserId } from '../../services/objectClient';
import { loadDeskNotes, addDeskNote, deleteDeskNote, moveDeskNote, updateDeskNote } from '../../services/deskNoteService';
import { claimDesk, transferDesk, releaseDesk } from '../../services/furnitureService';
import { loadProfile } from '../../services/profileClient';

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.80)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  } as React.CSSProperties,

  card: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 24,
    width: 860,
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    overflowY: 'auto' as const,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#e2e8f0',
  },

  closeBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 10px',
    lineHeight: 1,
  },

  messageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(37,99,235,0.15)',
    border: '1px solid rgba(99,179,237,0.3)',
    borderRadius: 8,
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px 14px',
    whiteSpace: 'nowrap' as const,
  },

  // Tischfläche — Höhe wird vom <img> oder vom Fallback-div bestimmt
  deskSurface: (dragOver: boolean) => ({
    position: 'relative' as const,
    width: '100%',
    borderRadius: 10,
    border: dragOver
      ? '2px dashed #f59e0b'
      : '2px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    transition: 'border-color 0.15s',
    cursor: 'default',
    userSelect: 'none' as const,
  }),

  deskImg: {
    display: 'block',
    width: '100%',
    height: 'auto',
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    draggable: false,
  },

  deskFallback: {
    height: 440,
    background: 'linear-gradient(150deg, #3b1f0a 0%, #5c2d0e 40%, #3b1f0a 100%)',
  },

  // Absolutes Layer über dem Bild für Overlay + Notizen
  deskAbsolute: {
    position: 'absolute' as const,
    inset: 0,
    pointerEvents: 'none' as const,
  },

  deskDimOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    pointerEvents: 'none' as const,
  },

  dropHint: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    pointerEvents: 'none' as const,
  },

  // Notiz auf dem Tisch
  note: (hover: boolean, dragging: boolean) => ({
    position: 'absolute' as const,
    width: 90,
    background: '#fef3c7',
    borderRadius: 4,
    padding: '6px 8px',
    boxShadow: dragging
      ? '4px 8px 20px rgba(0,0,0,0.6)'
      : hover
        ? '2px 4px 12px rgba(0,0,0,0.5)'
        : '1px 2px 6px rgba(0,0,0,0.4)',
    cursor: dragging ? 'grabbing' : 'grab',
    transition: dragging ? 'none' : 'box-shadow 0.15s, transform 0.1s',
    transform: dragging ? 'scale(1.08) rotate(2deg)' : hover ? 'scale(1.04)' : 'scale(1)',
    userSelect: 'none' as const,
    zIndex: dragging ? 20 : hover ? 10 : 1,
    pointerEvents: 'auto' as const,
    touchAction: 'none' as const,
  }),

  noteText: {
    fontSize: 10,
    color: '#1c1917',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 5,
    WebkitBoxOrient: 'vertical' as const,
  } as React.CSSProperties,

  noteAuthor: {
    fontSize: 9,
    color: '#78716c',
    marginTop: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },

  noteDeleteBtn: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    background: '#ef4444',
    border: 'none',
    borderRadius: '50%',
    width: 16,
    height: 16,
    color: '#fff',
    fontSize: 9,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    pointerEvents: 'auto' as const,
  },

  // Schreib-Bereich
  writeArea: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },

  textarea: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e2e8f0',
    fontSize: 13,
    resize: 'vertical' as const,
    minHeight: 72,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },

  dragPreview: (hasText: boolean) => ({
    width: 90,
    background: '#fef3c7',
    borderRadius: 4,
    padding: '8px',
    boxShadow: '1px 2px 6px rgba(0,0,0,0.4)',
    cursor: hasText ? 'grab' : 'not-allowed',
    opacity: hasText ? 1 : 0.4,
    fontSize: 10,
    color: '#1c1917',
    minHeight: 72,
    boxSizing: 'border-box' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    lineHeight: 1.4,
    userSelect: 'none' as const,
    flexShrink: 0,
  }),

  // Notiz-Leser (Overlay innerhalb des Modals)
  readerOverlay: {
    position: 'absolute' as const,
    inset: 0,
    borderRadius: 10,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    padding: 32,
    pointerEvents: 'auto' as const,
  },

  readerCard: {
    background: '#fef3c7',
    borderRadius: 8,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    position: 'relative' as const,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },

  readerText: {
    fontSize: 15,
    color: '#1c1917',
    lineHeight: 1.7,
    wordBreak: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
    overflowY: 'auto' as const,
    flex: 1,
  },

  readerMeta: {
    fontSize: 12,
    color: '#78716c',
    borderTop: '1px solid rgba(0,0,0,0.1)',
    paddingTop: 10,
  },

  readerClose: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    background: 'rgba(0,0,0,0.12)',
    border: 'none',
    borderRadius: 6,
    color: '#1c1917',
    cursor: 'pointer',
    padding: '2px 8px',
    fontSize: 14,
  },

  readerTextarea: {
    width: '100%',
    background: 'rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 14,
    color: '#1c1917',
    lineHeight: 1.7,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: 100,
    outline: 'none',
    boxSizing: 'border-box' as const,
    flex: 1,
  },

  readerFields: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },

  readerFieldLabel: {
    fontSize: 11,
    color: '#78716c',
    fontWeight: 600 as const,
    display: 'block' as const,
    marginBottom: 2,
  },

  readerFieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  readerDateInput: {
    flex: 1,
    fontSize: 12,
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 6,
    padding: '5px 8px',
    background: 'rgba(0,0,0,0.06)',
    color: '#1c1917',
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: 0,
  } as React.CSSProperties,

  readerUrlInput: {
    width: '100%',
    fontSize: 12,
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 6,
    padding: '5px 8px',
    background: 'rgba(0,0,0,0.06)',
    color: '#1c1917',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  readerTimeRow: {
    fontSize: 12,
    color: '#57534e',
    padding: '2px 0',
  },

  readerLink: {
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: 4,
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 600 as const,
    textDecoration: 'none',
    padding: '2px 0',
  },

  loginHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center' as const,
  },

  ownerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.07)',
    fontSize: 13,
  },

  ownerLabel: {
    flex: 1,
    color: '#94a3b8',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },

  ownerBtn: (color: string) => ({
    background: 'none',
    border: `1px solid ${color}`,
    borderRadius: 6,
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 10px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties),

  userPicker: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.07)',
    fontSize: 12,
  },
};

// ── Schreibtisch-Typ-Erkennung (synchron mit FurnitureLayer) ──────────────────

const DESK_TYPES = new Set(['desk', 'Schreibtisch', 'Arbeitsplatz', 'Arbeitsplätze']);
const isDeskType = (type: string) => DESK_TYPES.has(type);

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function toDateTimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
}

// ── Einzelne Notiz auf dem Tisch ──────────────────────────────────────────────

interface NoteOnDeskProps {
  note: DeskNote;
  canDelete: boolean;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  onRead: () => void;
  onDelete: () => void;
  onMoveLive: (id: string, x: number, y: number) => void;
  onMoveSave: (id: string, x: number, y: number) => void;
}

const NOTE_W_PX = 90;
const NOTE_H_PX = 80;
const DRAG_THRESHOLD = 5;

const NoteOnDesk: React.FC<NoteOnDeskProps> = ({
  note, canDelete, surfaceRef, onRead, onDelete, onMoveLive, onMoveSave,
}) => {
  const [hover,    setHover]    = useState(false);
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startNoteX: number;
    startNoteY: number;
    moved: boolean;
  } | null>(null);

  const getNewPos = (clientX: number, clientY: number) => {
    if (!surfaceRef.current || !dragRef.current) return null;
    const rect = surfaceRef.current.getBoundingClientRect();
    const dx = clientX - dragRef.current.startClientX;
    const dy = clientY - dragRef.current.startClientY;
    const noteW = NOTE_W_PX / rect.width;
    const noteH = NOTE_H_PX / rect.height;
    return {
      x: clamp(dragRef.current.startNoteX + dx / rect.width,  0, 1 - noteW),
      y: clamp(dragRef.current.startNoteY + dy / rect.height, 0, 1 - noteH),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNoteX: note.x,
      startNoteY: note.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (!dragRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
      setDragging(true);
    }
    if (!dragRef.current.moved) return;
    const pos = getNewPos(e.clientX, e.clientY);
    if (pos) onMoveLive(note.id, pos.x, pos.y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    if (dragRef.current.moved) {
      const pos = getNewPos(e.clientX, e.clientY);
      if (pos) onMoveSave(note.id, pos.x, pos.y);
    } else {
      onRead();
    }
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div
      style={{ ...S.note(hover, dragging), left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Klicken zum Lesen · Ziehen zum Verschieben"
    >
      {canDelete && hover && !dragging && (
        <button
          style={S.noteDeleteBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Notiz löschen"
        >
          ✕
        </button>
      )}
      <div style={S.noteText}>{note.text}</div>
      <div style={S.noteAuthor}>{note.authorName}</div>
    </div>
  );
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────

interface PresenceUser { userId: string; name: string; }

const DeskModal: React.FC = () => {
  const { openDeskId, openDeskOwnerId, openDeskOwnerName, notes, readingNote } = useDeskStore();
  const { closeDesk, setReadingNote } = useDeskStore();
  const jwt         = useAuthStore((s) => s.jwt);
  const isAdmin     = useAuthStore((s) => {
    if (!s.jwt) return false;
    try {
      const p = JSON.parse(atob(s.jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Array.isArray(p.roles) && p.roles.includes('admin');
    } catch { return false; }
  });
  const myName      = usePlayerStore((s) => s.name);
  const myId        = getJwtUserId();
  const isGuest     = myId?.startsWith('g_') ?? false;
  const placedItems = useFurnitureStore((s) => s.placedItems);
  const deskImageUrl = openDeskId
    ? placedItems.find((i) => i.id === openDeskId)?.imageUrl
    : undefined;

  // Aktueller Eigentümer-Name (live aus Profil aufgelöst, Fallback auf gespeicherten Namen)
  const [resolvedOwnerName, setResolvedOwnerName] = useState(openDeskOwnerName);

  const [noteText,        setNoteText]        = useState('');
  const [dragOver,        setDragOver]        = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [showPicker,      setShowPicker]      = useState(false);
  const [onlineUsers,     setOnlineUsers]     = useState<PresenceUser[]>([]);
  const [loadingUsers,    setLoadingUsers]    = useState(false);
  const [editText,        setEditText]        = useState('');
  const [editTimeStart,   setEditTimeStart]   = useState('');
  const [editTimeEnd,     setEditTimeEnd]     = useState('');
  const [editMeetingLink, setEditMeetingLink] = useState('');

  const deskSurfaceRef = useRef<HTMLDivElement>(null);

  const isDeskOwner = !!(myId && openDeskOwnerId && openDeskOwnerId === myId);
  const canMessage  = jwt !== null
    && openDeskOwnerId
    && openDeskOwnerId !== myId
    && !openDeskOwnerId.startsWith('bot_');
  const hasOwnDesk  = !!myId && placedItems.some(
    (item) => isDeskType(item.type) && item.deskUserId === myId,
  );
  const canClaim    = jwt !== null && !isGuest && !openDeskOwnerId && !hasOwnDesk;
  const canTransfer = isDeskOwner || isAdmin;
  const canRelease  = isDeskOwner || isAdmin;
  const canEditNote = !!(jwt && readingNote && (isDeskOwner || readingNote.authorId === myId || isAdmin));

  const handleOpenMessage = useCallback(() => {
    useMessageStore.getState().setActiveUserId(openDeskOwnerId);
    useMessageStore.getState().openPanel();
    closeDesk();
  }, [openDeskOwnerId, closeDesk]);

  const handleClaim = useCallback(async () => {
    if (!openDeskId) return;
    await claimDesk(openDeskId);
    useDeskStore.getState().openDesk(openDeskId, myId ?? '', myName);
  }, [openDeskId, myId, myName]);

  const handleRelease = useCallback(async () => {
    if (!openDeskId) return;
    await releaseDesk(openDeskId);
    useDeskStore.getState().openDesk(openDeskId, '', '');
    setShowPicker(false);
  }, [openDeskId]);

  const openUserPicker = useCallback(async () => {
    setShowPicker(true);
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/presence/users', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const { users } = await res.json() as { users: PresenceUser[] };
      setOnlineUsers((users ?? []).filter((u) => u.userId !== myId));
    } catch { setOnlineUsers([]); }
    finally { setLoadingUsers(false); }
  }, [jwt, myId]);

  const handleTransfer = useCallback(async (toUserId: string, toUserName: string) => {
    if (!openDeskId) return;
    await transferDesk(openDeskId, toUserId, toUserName);
    useDeskStore.getState().openDesk(openDeskId, toUserId, toUserName);
    setShowPicker(false);
  }, [openDeskId]);

  const handleSaveNote = useCallback(async () => {
    if (!readingNote || !canEditNote) return;
    const patch: Partial<Pick<DeskNote, 'text' | 'timeStart' | 'timeEnd' | 'meetingLink'>> = {
      text:        editText,
      timeStart:   editTimeStart   ? new Date(editTimeStart).toISOString()   : undefined,
      timeEnd:     editTimeEnd     ? new Date(editTimeEnd).toISOString()     : undefined,
      meetingLink: editMeetingLink || undefined,
    };
    // updateDeskNote aktualisiert bereits den notes-Array im Store.
    // Kein setReadingNote danach — das würde den Reader nach dem Schließen wieder öffnen.
    await updateDeskNote(readingNote.id, patch);
  }, [readingNote, canEditNote, editText, editTimeStart, editTimeEnd, editMeetingLink]);

  useEffect(() => {
    if (!openDeskId) return;
    setLoading(true);
    loadDeskNotes(openDeskId).finally(() => setLoading(false));
  }, [openDeskId]);

  // Eigentümer-Name live aus Profil auflösen (korrekter Name nach Umbenennungen)
  useEffect(() => {
    setResolvedOwnerName(openDeskOwnerName);
    if (!openDeskOwnerId) return;
    loadProfile(openDeskOwnerId)
      .then((res) => {
        if (!res) return;
        const { firstName, lastName } = res.profile;
        const name = [firstName, lastName].filter(Boolean).join(' ');
        if (name) setResolvedOwnerName(name);
      })
      .catch(() => {});
  }, [openDeskOwnerId, openDeskOwnerName]);

  useEffect(() => {
    if (!readingNote) return;
    setEditText(readingNote.text);
    setEditTimeStart(toDateTimeLocal(readingNote.timeStart));
    setEditTimeEnd(toDateTimeLocal(readingNote.timeEnd));
    setEditMeetingLink(readingNote.meetingLink ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingNote?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (readingNote) {
          void handleSaveNote();
          setReadingNote(null);
        } else closeDesk();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readingNote, closeDesk, setReadingNote, handleSaveNote]);

  // ── HTML5 DnD — neue Notiz ablegen ────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!deskSurfaceRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const text = e.dataTransfer.getData('desk-note-text');
    if (!text.trim() || !deskSurfaceRef.current || !openDeskId) return;

    const rect  = deskSurfaceRef.current.getBoundingClientRect();
    const noteW = NOTE_W_PX / rect.width;
    const noteH = NOTE_H_PX / rect.height;
    const rawX  = (e.clientX - rect.left) / rect.width;
    const rawY  = (e.clientY - rect.top)  / rect.height;
    const x = clamp(rawX - noteW / 2, 0, 1 - noteW);
    const y = clamp(rawY - noteH / 2, 0, 1 - noteH);

    await addDeskNote(openDeskId, text.trim(), x, y, myName);
    setNoteText('');
  }, [openDeskId, myName]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!noteText.trim()) { e.preventDefault(); return; }
    e.dataTransfer.setData('desk-note-text', noteText);
    e.dataTransfer.effectAllowed = 'copy';
  }, [noteText]);

  // ── Notiz löschen ─────────────────────────────────────────────────────────

  const handleDeleteNote = useCallback((note: DeskNote) => {
    const canDelete = isDeskOwner || note.authorId === myId;
    if (!canDelete) return;
    deleteDeskNote(note.id);
  }, [isDeskOwner, myId]);

  // ── Notiz verschieben ─────────────────────────────────────────────────────

  const handleMoveLive = useCallback((id: string, x: number, y: number) => {
    useDeskStore.getState().updateNote(id, { x, y });
  }, []);

  const handleMoveSave = useCallback((id: string, x: number, y: number) => {
    moveDeskNote(id, x, y);
  }, []);

  if (!openDeskId) return null;

  const hasText = noteText.trim().length > 0;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeDesk(); }}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>
            {resolvedOwnerName ? `${resolvedOwnerName}'s Schreibtisch` : 'Freier Schreibtisch'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canMessage && (
              <button style={S.messageBtn} onClick={handleOpenMessage}>
                💬 Nachricht schreiben
              </button>
            )}
            <button style={S.closeBtn} onClick={closeDesk}>✕</button>
          </div>
        </div>

        {/* Eigentümer-Leiste */}
        <div style={S.ownerBar}>
          <span style={S.ownerLabel}>
            {openDeskOwnerId
              ? `👤 ${resolvedOwnerName || openDeskOwnerName}`
              : '🪑 Kein Eigentümer'}
          </span>
          {canClaim && (
            <button style={S.ownerBtn('#34d399')} onClick={handleClaim}>
              Annektieren
            </button>
          )}
          {jwt && !isGuest && !openDeskOwnerId && hasOwnDesk && (
            <span style={{ color: '#f59e0b', fontSize: 12 }}>
              Du hast bereits einen Schreibtisch
            </span>
          )}
          {canTransfer && openDeskOwnerId && (
            <button style={S.ownerBtn('#60a5fa')} onClick={openUserPicker}>
              Weitergeben
            </button>
          )}
          {isAdmin && !openDeskOwnerId && (
            <button style={S.ownerBtn('#60a5fa')} onClick={openUserPicker}>
              Zuweisen
            </button>
          )}
          {canRelease && openDeskOwnerId && (
            <button style={S.ownerBtn('#f87171')} onClick={handleRelease}>
              Freigeben
            </button>
          )}
        </div>

        {/* User-Picker für Weitergabe / Admin-Zuweisung */}
        {showPicker && (
          <div style={S.userPicker}>
            <span style={{ color: '#64748b', alignSelf: 'center' }}>An wen?</span>
            {loadingUsers && <span style={{ color: '#94a3b8' }}>Lädt…</span>}
            {!loadingUsers && onlineUsers.length === 0 && (
              <span style={{ color: '#64748b' }}>Keine anderen Nutzer online</span>
            )}
            {onlineUsers.map((u) => (
              <button
                key={u.userId}
                style={S.ownerBtn('#94a3b8')}
                onClick={() => handleTransfer(u.userId, u.name)}
              >
                {u.name}
              </button>
            ))}
            <button style={S.ownerBtn('#64748b')} onClick={() => setShowPicker(false)}>
              Abbrechen
            </button>
          </div>
        )}

        {/* Tischfläche */}
        <div
          ref={deskSurfaceRef}
          style={S.deskSurface(dragOver)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Bild bestimmt die Höhe — oder Fallback-div */}
          {deskImageUrl
            ? <img src={deskImageUrl} alt="" style={S.deskImg} draggable={false} />
            : <div style={S.deskFallback} />
          }

          {/* Absolutes Layer: Notizen + Overlays */}
          <div style={S.deskAbsolute}>

            {!loading && notes.length === 0 && (
              <div style={S.dropHint}>
                {jwt ? 'Notiz schreiben und hierher ziehen' : 'Noch keine Notizen'}
              </div>
            )}

            {notes.map((note) => {
              const canDelete = !!(isDeskOwner || note.authorId === myId);
              return (
                <NoteOnDesk
                  key={note.id}
                  note={note}
                  canDelete={canDelete}
                  surfaceRef={deskSurfaceRef}
                  onRead={() => setReadingNote(note)}
                  onDelete={() => handleDeleteNote(note)}
                  onMoveLive={handleMoveLive}
                  onMoveSave={handleMoveSave}
                />
              );
            })}

            {/* Notiz-Leser Overlay */}
            {readingNote && (
              <div style={S.readerOverlay} onClick={() => { void handleSaveNote(); setReadingNote(null); }}>
                <div style={S.readerCard} onClick={(e) => e.stopPropagation()}>
                  <button style={S.readerClose} onClick={() => { void handleSaveNote(); setReadingNote(null); }}>✕</button>

                  {canEditNote ? (
                    <textarea
                      style={S.readerTextarea}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={handleSaveNote}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                          e.preventDefault();
                          void handleSaveNote();
                        }
                      }}
                      autoFocus
                      placeholder="Notiztext…"
                      maxLength={1000}
                    />
                  ) : (
                    <div style={S.readerText}>{readingNote.text}</div>
                  )}

                  {canEditNote && (
                    <div style={S.readerFields}>
                      <div>
                        <span style={S.readerFieldLabel}>Zeitraum</span>
                        <div style={S.readerFieldRow}>
                          <input
                            type="datetime-local"
                            style={S.readerDateInput}
                            value={editTimeStart}
                            onChange={(e) => setEditTimeStart(e.target.value)}
                            onBlur={handleSaveNote}
                          />
                          <span style={{ color: '#78716c', flexShrink: 0 }}>–</span>
                          <input
                            type="datetime-local"
                            style={S.readerDateInput}
                            value={editTimeEnd}
                            onChange={(e) => setEditTimeEnd(e.target.value)}
                            onBlur={handleSaveNote}
                          />
                        </div>
                      </div>
                      <div>
                        <span style={S.readerFieldLabel}>Meeting-Link</span>
                        <input
                          type="url"
                          style={S.readerUrlInput}
                          value={editMeetingLink}
                          onChange={(e) => setEditMeetingLink(e.target.value)}
                          onBlur={handleSaveNote}
                          placeholder="https://…"
                        />
                      </div>
                    </div>
                  )}

                  {!canEditNote && (readingNote.timeStart || readingNote.timeEnd) && (
                    <div style={S.readerTimeRow}>
                      🕐 {readingNote.timeStart ? formatDate(readingNote.timeStart) : ''}
                      {readingNote.timeEnd ? ` – ${formatDate(readingNote.timeEnd)}` : ''}
                    </div>
                  )}
                  {!canEditNote && readingNote.meetingLink && (
                    <a
                      href={readingNote.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.readerLink}
                    >
                      🔗 Meeting öffnen
                    </a>
                  )}

                  <div style={S.readerMeta}>
                    Von {readingNote.authorName} · {formatDate(readingNote.createdAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schreib-Bereich — nur für eingeloggte Nutzer */}
        {jwt ? (
          <div style={S.writeArea}>
            <textarea
              style={S.textarea}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Notiz schreiben…"
              maxLength={1000}
            />
            <div
              draggable={hasText}
              onDragStart={handleDragStart}
              style={S.dragPreview(hasText)}
              title={hasText ? 'Auf den Tisch ziehen' : 'Zuerst Text eingeben'}
            >
              {hasText ? noteText.slice(0, 60) + (noteText.length > 60 ? '…' : '') : '📌\nNotiz auf\nden Tisch\nziehen'}
            </div>
          </div>
        ) : (
          <p style={S.loginHint}>Einloggen um Notizen zu hinterlassen</p>
        )}

      </div>
    </div>
  );
};

export default DeskModal;
