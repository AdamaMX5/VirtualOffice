import React, { useEffect, useState } from 'react';
import { useGuestWaitStore } from '../../model/stores/guestWaitStore';
import { usePlayerStore } from '../../model/stores/playerStore';

const EARLY_MS = 15 * 60 * 1000; // 15 Minuten Vorlaufzeit

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getRemainingMs(appointmentTime: number): number {
  return Math.max(0, appointmentTime - EARLY_MS - Date.now());
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const GuestWaitScreen: React.FC = () => {
  const info       = useGuestWaitStore((s) => s.tooEarlyInfo);
  const setInfo    = useGuestWaitStore((s) => s.setTooEarlyInfo);
  const [rem, setRem] = useState(() => info ? getRemainingMs(info.appointmentTime) : 0);

  useEffect(() => {
    if (!info) return;
    setRem(getRemainingMs(info.appointmentTime));
    const tick = setInterval(() => {
      const r = getRemainingMs(info.appointmentTime);
      setRem(r);
      if (r <= 0) {
        clearInterval(tick);
        usePlayerStore.getState().setName(info.guestName || 'Gast');
        setInfo(null);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [info, setInfo]);

  if (!info) return null;

  const enterTime  = info.appointmentTime - EARLY_MS;
  const almostTime = rem < 5 * 60 * 1000;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #0f172a, #1e293b)',
        border: '1px solid rgba(99,179,237,0.2)',
        borderRadius: 20,
        padding: '40px 48px',
        maxWidth: 480,
        width: '90vw',
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>

        <div style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Willkommen, {info.guestName}!
        </div>
        <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>
          Eingeladen von{' '}
          <strong style={{ color: '#e2e8f0' }}>{info.inviterName}</strong>
        </div>

        {/* Termin-Box */}
        <div style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700,
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            ⏰ Ihr Termin
          </div>
          <div style={{ color: '#e2e8f0', fontSize: 28, fontWeight: 800 }}>
            {fmtTime(info.appointmentTime)} Uhr
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            {fmtDate(info.appointmentTime)}
          </div>
        </div>

        {/* Countdown */}
        <div style={{
          background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(99,179,237,0.1)',
          borderRadius: 12, padding: '18px 24px', marginBottom: 20,
        }}>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
            Einlass ab {fmtTime(enterTime)} Uhr
          </div>
          <div style={{
            color: almostTime ? '#34d399' : '#60a5fa',
            fontSize: 36, fontWeight: 800,
            fontFamily: 'monospace', letterSpacing: 3,
            transition: 'color 0.5s',
          }}>
            {fmtRemaining(rem)}
          </div>
          <div style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>
            {almostTime ? 'Einlass öffnet gleich…' : 'verbleibend'}
          </div>
        </div>

        <div style={{ color: '#334155', fontSize: 11, lineHeight: 1.5 }}>
          Sie werden automatisch eingelassen, sobald die Einlasszeit erreicht ist.
        </div>
      </div>
    </div>
  );
};

export default GuestWaitScreen;
