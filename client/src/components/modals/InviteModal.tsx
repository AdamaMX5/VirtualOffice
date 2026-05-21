import React, { useState, useCallback, useEffect } from 'react';
import { useInviteModalStore } from '../../model/stores/inviteModalStore';
import { useAuthStore } from '../../model/stores/authStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { useMapStore } from '../../model/stores/mapStore';
import { createObject } from '../../services/objectClient';

interface OnlineUser { userId: string; name: string; }

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 3000,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16, padding: 28,
    width: 420, maxWidth: '95vw',
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: '#e2e8f0' },
  label: { display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5 },
  input: {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '9px 12px',
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  row: { display: 'flex', gap: 10 },
  btnPrimary: {
    flex: 1, padding: '10px 0',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  },
  hint: { color: '#475569', fontSize: 11, lineHeight: 1.5 },
  success: {
    padding: '10px 14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 8, color: '#86efac', fontSize: 13, textAlign: 'center' as const,
  },
};

// ── Komponente ────────────────────────────────────────────────────────────────

const InviteModal: React.FC = () => {
  const { isOpen, close } = useInviteModalStore();
  const jwt        = useAuthStore((s) => s.jwt);
  const myName     = usePlayerStore((s) => s.name);
  const myId       = useAuthStore((s) => s.userId);
  const rooms      = useMapStore((s) => s.rooms);

  const [guestName,       setGuestName]       = useState('');
  const [roomId,          setRoomId]          = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [inviterUserId,   setInviterUserId]   = useState('');
  const [onlineUsers,     setOnlineUsers]     = useState<OnlineUser[]>([]);
  const [copied,          setCopied]          = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  // Online-User für Einlader-Auswahl laden
  useEffect(() => {
    if (!isOpen || !jwt) return;
    fetch('/api/presence/users', { headers: { Authorization: `Bearer ${jwt}` } })
      .then((r) => r.json())
      .then((d: { users: OnlineUser[] }) => setOnlineUsers(d.users))
      .catch(() => setOnlineUsers([]));
  }, [isOpen, jwt]);

  // Eigene ID vorauswählen sobald verfügbar
  useEffect(() => {
    if (myId) setInviterUserId(myId);
  }, [myId]);

  const handleClose = useCallback(() => {
    setCopied(false);
    setError('');
    setGuestName('');
    setRoomId('');
    setAppointmentTime('');
    close();
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  const handleCreate = useCallback(async () => {
    if (!guestName.trim()) { setError('Bitte einen Gastnamen eingeben.'); return; }
    setLoading(true); setError('');
    try {
      const inviterName = onlineUsers.find((u) => u.userId === inviterUserId)?.name ?? myName;
      const inviterId   = inviterUserId || myId || '';
      const tokenBytes  = crypto.getRandomValues(new Uint8Array(16));
      const token       = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt   = Date.now() + 24 * 60 * 60 * 1000;
      const apptTime    = appointmentTime ? new Date(appointmentTime).getTime() : null;

      await createObject(
        'invitations',
        {
          token, inviterId, inviterName,
          guestName:       guestName.trim(),
          roomId:          roomId || null,
          appointmentTime: apptTime,
          expiresAt,
          createdAt:       Date.now(),
        },
        { token, inviterId },
      );

      await navigator.clipboard.writeText(`${window.location.origin}?invite=${token}`);
      setCopied(true);
    } catch {
      setError('Fehler beim Erstellen der Einladung.');
    } finally {
      setLoading(false);
    }
  }, [guestName, roomId, appointmentTime, inviterUserId, myId, myName, onlineUsers]);

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={S.card}>
        <h2 style={S.title}>🔗 Gast einladen</h2>

        {/* Gastname */}
        <div>
          <label style={S.label}>Name des Gastes *</label>
          <input
            style={S.input}
            type="text"
            placeholder="z.B. Max Mustermann"
            maxLength={60}
            value={guestName}
            onChange={(e) => { setGuestName(e.target.value); setCopied(false); }}
            autoFocus
          />
        </div>

        {/* Raum */}
        <div>
          <label style={S.label}>Raum (optional)</label>
          <select
            style={S.select}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="">– Kein bestimmter Raum –</option>
            {rooms.map((r) => (
              <option key={r.label} value={r.label}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Termin */}
        <div>
          <label style={S.label}>Termin (optional, 15 Min. Vorlauf erlaubt)</label>
          <input
            style={S.input}
            type="datetime-local"
            value={appointmentTime}
            onChange={(e) => setAppointmentTime(e.target.value)}
          />
        </div>

        {/* Einlader */}
        <div>
          <label style={S.label}>Einlader</label>
          <select
            style={S.select}
            value={inviterUserId}
            onChange={(e) => setInviterUserId(e.target.value)}
          >
            {onlineUsers.length === 0 && (
              <option value={myId}>{myName} (ich)</option>
            )}
            {onlineUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name}{u.userId === myId ? ' (ich)' : ''}
              </option>
            ))}
          </select>
        </div>

        {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}

        {copied ? (
          <div style={S.success}>✅ Link in Zwischenablage kopiert!</div>
        ) : null}

        {copied && appointmentTime && (
          <div style={S.hint}>
            Gast kann ab{' '}
            <strong style={{ color: '#e2e8f0' }}>
              {new Date(new Date(appointmentTime).getTime() - 15 * 60 * 1000)
                .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </strong>{' '}
            Uhr (15 Min. früher) beitreten.
          </div>
        )}

        <div style={S.row}>
          <button
            style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? '⏳ Erstelle…' : copied ? '🔄 Neu erstellen' : '📋 Link erstellen & kopieren'}
          </button>
          <button style={S.btnSecondary} onClick={handleClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
