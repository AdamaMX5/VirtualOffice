import React, { useEffect, useState } from 'react';
import { useReceptionMenuStore } from '../model/stores/receptionMenuStore';
import { presenceSend } from '../hooks/usePresence';

interface OnlineUser {
  userId:     string;
  name:       string;
  department?: string;
}

// ── Stile ────────────────────────────────────────────────────────────────────

const menuCard: React.CSSProperties = {
  position: 'fixed',
  background: '#0f172a',
  border: '1px solid rgba(99,179,237,0.25)',
  borderRadius: 10,
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  minWidth: 230,
  maxWidth: 280,
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
  padding: '9px 14px',
  background: 'none',
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  color: '#e2e8f0',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left' as const,
};

const notifyAllBtn: React.CSSProperties = {
  ...menuItem,
  color: '#7dd3fc',
  fontWeight: 600,
};

const subLabel: React.CSSProperties = {
  color: '#475569',
  fontSize: 11,
  padding: '6px 14px 4px',
};

// ── Komponente ────────────────────────────────────────────────────────────────

const ReceptionMenu = () => {
  const { isOpen, screenX, screenY, close } = useReceptionMenuStore();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/presence/users')
      .then((r) => r.json())
      .then((d: { users: OnlineUser[] }) => setUsers(d.users))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const menuH = 80 + users.length * 42 + 50;
  const left  = Math.min(screenX, window.innerWidth  - 240 - 8);
  const top   = Math.min(screenY, window.innerHeight - menuH - 8);

  const notify = (userId: string) => {
    presenceSend({ type: 'notify_user', targetUserId: userId, callType: 'call' });
    close();
  };

  const notifyAll = () => {
    users.forEach((u) => presenceSend({ type: 'notify_user', targetUserId: u.userId, callType: 'call' }));
    close();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
      onMouseDown={close}
    >
      <div
        style={{ ...menuCard, left, top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={menuHeader}>Empfang</div>
        <div style={menuName}>Empfangs-Bot</div>

        <button
          style={notifyAllBtn}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          onClick={notifyAll}
          disabled={users.length === 0}
        >
          <span>📣</span> Alle benachrichtigen
        </button>

        {users.length > 0 && <div style={subLabel}>Online-Mitarbeiter</div>}

        {loading && (
          <div style={{ ...subLabel, padding: '10px 14px' }}>Lade...</div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ ...subLabel, padding: '10px 14px', color: '#475569' }}>
            Keine Mitarbeiter online
          </div>
        )}

        {users.map((u) => (
          <button
            key={u.userId}
            style={menuItem}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            onClick={() => notify(u.userId)}
          >
            <span>📞</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name}{u.department ? ` · ${u.department}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReceptionMenu;
