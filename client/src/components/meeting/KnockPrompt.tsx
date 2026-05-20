import React, { useState } from 'react';
import { useRoomLockStore } from '../../model/stores/roomLockStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { presenceSend } from '../../hooks/usePresence';

const KnockPrompt: React.FC = () => {
  const currentRoom    = usePlayerStore((s) => s.currentRoom);
  const admitted       = useRoomLockStore((s) => s.admitted);
  const lockedRooms    = useRoomLockStore((s) => s.lockedRooms);
  const [knocked, setKnocked] = useState(false);

  const isInMeetingRoom = currentRoom === 'Meetingraum';
  const isLocked        = 'Meetingraum' in lockedRooms;

  // Reset knocked state when room unlocks or we leave
  React.useEffect(() => {
    if (!isLocked || !isInMeetingRoom) setKnocked(false);
  }, [isLocked, isInMeetingRoom]);

  if (!isInMeetingRoom || !isLocked || admitted) return null;

  const handleKnock = () => {
    presenceSend({ type: 'room_knock', room: 'Meetingraum' });
    setKnocked(true);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1500,
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(251,191,36,0.35)',
      borderRadius: 14,
      padding: '16px 24px',
      textAlign: 'center',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      minWidth: 240,
    }}>
      <div style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        🔒 Meetingraum gesperrt
      </div>
      {knocked ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>
          Anklopfen gesendet… warte auf Einlass.
        </div>
      ) : (
        <>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
            Das Meeting läuft gerade. Möchtest du anklopfen?
          </div>
          <button
            onClick={handleKnock}
            style={{
              background: 'linear-gradient(135deg,#d97706,#f59e0b)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '9px 24px',
              cursor: 'pointer',
            }}
          >
            🚪 Anklopfen
          </button>
        </>
      )}
    </div>
  );
};

export default KnockPrompt;
