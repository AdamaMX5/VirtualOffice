import React, { useEffect, useRef, useState } from 'react';
import { useContextMenuStore } from '../model/stores/contextMenuStore';
import { useMessageStore } from '../model/stores/messageStore';
import { useFollowStore } from '../model/stores/followStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useAuthStore } from '../model/stores/authStore';
import { setFollowTarget } from '../hooks/useGameLoop';
import { presenceSend } from '../hooks/usePresence';
import { createObject, getJwtUserId } from '../services/objectClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nextHourStr() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toTimeString().slice(0, 5);
}

// ── Stile ────────────────────────────────────────────────────────────────────
const menuCard: React.CSSProperties = {
  position: 'fixed',
  background: '#0f172a',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 10,
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  minWidth: 210,
  zIndex: 3000,
  overflow: 'hidden',
};

const menuHeader: React.CSSProperties = {
  padding: '10px 14px 8px',
  borderBottom: '1px solid rgba(99,179,237,0.12)',
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

const menuName: React.CSSProperties = {
  color: '#e2e8f0',
  fontSize: 14,
  fontWeight: 600,
  padding: '0 14px 10px',
};

const menuItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 14px',
  background: 'none',
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  color: '#e2e8f0',
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left' as const,
};

const aptForm: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const aptLabel: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  marginBottom: 2,
};

const aptInput: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1e293b',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 6,
  padding: '7px 10px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
};

const aptRow: React.CSSProperties = { display: 'flex', gap: 8 };

const aptSaveBtn: React.CSSProperties = {
  background: '#2563eb', border: 'none', borderRadius: 6,
  padding: '8px 0', color: '#fff', fontWeight: 600, fontSize: 13,
  cursor: 'pointer', flex: 1,
};

const aptCancelBtn: React.CSSProperties = {
  background: '#1e293b', border: '1px solid rgba(99,179,237,0.2)',
  borderRadius: 6, padding: '8px 0', color: '#94a3b8',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', flex: 1,
};

// ── Komponente ────────────────────────────────────────────────────────────────

const AvatarContextMenu = () => {
  const { isOpen, targetUserId, targetName, screenX, screenY, close } = useContextMenuStore();
  const [view, setView] = useState<'menu' | 'appointment'>('menu');

  // Appointment-State
  const [aptTitle,    setAptTitle]    = useState('');
  const [aptDate,     setAptDate]     = useState(todayStr);
  const [aptTime,     setAptTime]     = useState(nextHourStr);
  const [aptDuration, setAptDuration] = useState(60);
  const [aptSaving,   setAptSaving]   = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Reset beim Öffnen
  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setAptTitle('');
      setAptDate(todayStr());
      setAptTime(nextHourStr());
      setAptDuration(60);
      setAptSaving(false);
    }
  }, [isOpen]);

  // ESC schließt das Menü
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Menü-Position: Viewport-Überlauf vermeiden
  const menuW = view === 'menu' ? 210 : 260;
  const menuH = view === 'menu' ? 190 : 320;
  const left  = Math.min(screenX, window.innerWidth  - menuW - 8);
  const top   = Math.min(screenY, window.innerHeight - menuH - 8);

  // ── Handler ──────────────────────────────────────────────────

  const handleFollow = () => {
    setFollowTarget(targetUserId, targetName);
    close();
  };

  const handleMessage = () => {
    useMessageStore.getState().setActiveUserId(targetUserId);
    useMessageStore.getState().openPanel();
    // Auch openPanel im OfficeCanvas-State nötig — wird über panelOpen im messageStore gesteuert
    close();
  };

  const handleCall = () => {
    presenceSend({ type: 'notify_user', targetUserId, callType: 'call' });
    close();
  };

  const handleSaveAppointment = async () => {
    setAptSaving(true);
    try {
      const myId   = getJwtUserId();
      const myName = usePlayerStore.getState().name;
      const start  = new Date(`${aptDate}T${aptTime}`);
      const end    = new Date(start.getTime() + aptDuration * 60_000);

      await createObject(
        'appointments',
        {
          title:         aptTitle.trim() || `Besprechung mit ${targetName}`,
          start:         start.toISOString(),
          end:           end.toISOString(),
          creatorName:   myName,
          participantName: targetName,
        },
        { creatorId: myId, participantId: targetUserId },
        'VirtualOffice',
        false, // nicht öffentlich
      );

      presenceSend({ type: 'notify_user', targetUserId, callType: 'appointment' });
      close();
    } catch (err) {
      console.error('Termin-Fehler:', err);
    } finally {
      setAptSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    // Klick außerhalb schließt
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
      onMouseDown={close}
    >
      <div
        ref={menuRef}
        style={{ ...menuCard, left, top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={menuHeader}>Nutzer</div>
        <div style={menuName}>{targetName}</div>

        {view === 'menu' ? (
          <>
            <button
              style={menuItem}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={handleFollow}
            >
              <span>🏃</span> Folgen
            </button>
            <button
              style={menuItem}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={handleMessage}
            >
              <span>💬</span> Nachricht schreiben
            </button>
            <button
              style={menuItem}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={() => setView('appointment')}
            >
              <span>📅</span> Termin eintragen
            </button>
            <button
              style={menuItem}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              onClick={handleCall}
            >
              <span>📞</span> Anrufen
            </button>
          </>
        ) : (
          /* ── Termin-Formular ── */
          <div style={aptForm}>
            <div>
              <div style={aptLabel}>Titel</div>
              <input
                style={aptInput}
                value={aptTitle}
                onChange={(e) => setAptTitle(e.target.value)}
                placeholder={`Besprechung mit ${targetName}`}
                autoFocus
              />
            </div>
            <div style={aptRow}>
              <div style={{ flex: 1 }}>
                <div style={aptLabel}>Datum</div>
                <input style={aptInput} type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={aptLabel}>Uhrzeit</div>
                <input style={aptInput} type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} />
              </div>
            </div>
            <div>
              <div style={aptLabel}>Dauer</div>
              <select style={aptInput} value={aptDuration} onChange={(e) => setAptDuration(Number(e.target.value))}>
                <option value={30}>30 Minuten</option>
                <option value={60}>1 Stunde</option>
                <option value={90}>1,5 Stunden</option>
                <option value={120}>2 Stunden</option>
              </select>
            </div>
            <div style={aptRow}>
              <button style={aptCancelBtn} onClick={() => setView('menu')}>Zurück</button>
              <button
                style={{ ...aptSaveBtn, opacity: aptSaving ? 0.6 : 1 }}
                onClick={handleSaveAppointment}
                disabled={aptSaving}
              >
                {aptSaving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarContextMenu;
