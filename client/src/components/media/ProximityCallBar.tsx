import { useSyncExternalStore } from 'react';
import { getActiveProxCall, subscribeActiveProxCall, leaveProxRoom } from '../../hooks/useProximityCall';
import { presenceSend } from '../../hooks/usePresence';

const S = {
  bar: {
    position: 'fixed' as const,
    bottom: 72,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1500,
    background: 'rgba(15,23,42,0.92)',
    border: '1px solid rgba(99,179,237,0.4)',
    borderRadius: 40,
    padding: '8px 20px 8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 500,
    userSelect: 'none' as const,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  hangUp: {
    background: '#ef4444',
    border: 'none',
    borderRadius: 20,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

export default function ProximityCallBar() {
  const call = useSyncExternalStore(subscribeActiveProxCall, getActiveProxCall);
  if (!call) return null;

  const handleHangUp = () => {
    presenceSend({ type: 'proximity_exit', targetUserId: call.partnerUserId, roomName: call.roomName });
    leaveProxRoom();
  };

  return (
    <div style={S.bar}>
      <div style={S.dot} />
      <span>Gespräch mit <strong>{call.partnerName}</strong></span>
      <button style={S.hangUp} onClick={handleHangUp}>Auflegen</button>
    </div>
  );
}
