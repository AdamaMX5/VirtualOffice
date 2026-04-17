import React, { useState } from 'react';
import { useAuthStore } from '../../model/stores/authStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { apiPost } from '../../services/apiClient';
import { AUTH_URL } from '../../model/constants';

type Step = 'guest_or_login' | 'confirm_register';

interface LoginResponse {
  accessToken: string;
  email: string;
  status: string;
  id?: string;
}
interface RegisterResponse {
  accessToken: string;
  email: string;
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(6px)',
};
const card: React.CSSProperties = {
  background: '#1e1e2e',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16, padding: 36, minWidth: 340, textAlign: 'center',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 10,
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: 10, borderRadius: 8,
  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
  border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  width: '100%', padding: 10, borderRadius: 8,
  background: '#374151', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20,
};
const btnGreen: React.CSSProperties = {
  width: '100%', padding: 10, borderRadius: 8,
  background: '#059669', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const LoginModal = () => {
  const closeModal = useAuthStore((s) => s.closeModal);
  const setJwt     = useAuthStore((s) => s.setJwt);
  const setName    = usePlayerStore((s) => s.setName);

  const [step,       setStep]       = useState<Step>('guest_or_login');
  const [guestName,  setGuestName]  = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [repassword, setRepassword] = useState('');
  const [error,      setError]      = useState('');
  const [info,       setInfo]       = useState('');
  const [loading,    setLoading]    = useState(false);

  function handleGuest() {
    const name = guestName.trim() || 'Gast';
    setName(name);
    closeModal();
  }

  async function handleLogin() {
    setLoading(true); setError(''); setInfo('');
    try {
      const data = await apiPost<LoginResponse>('/api/auth/login', {
        email,
        password,
        deviceFingerprint: navigator.userAgent,
        deviceName: 'Virtual Office Web',
      });

      if (data.status === 'login' || data.status === 'login_with_verify_email_send') {
        if (data.status === 'login_with_verify_email_send') {
          setInfo('Eingeloggt! Verifikations-E-Mail wurde gesendet.');
        }
        setJwt(data.accessToken, data.email);
        setName(data.email);
        closeModal();
      } else if (data.status === 'register') {
        setStep('confirm_register');
        setInfo('Neuer Account – bitte Passwort bestätigen.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setLoading(false);
  }

  async function handleRegister() {
    setLoading(true); setError('');
    try {
      const data = await apiPost<RegisterResponse>(`${AUTH_URL}/user/register`, {
        email,
        repassword,
        deviceFingerprint: navigator.userAgent,
        deviceName: 'Virtual Office Web',
      });
      setJwt(data.accessToken, data.email);
      setName(data.email);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setLoading(false);
  }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏢</div>
        <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
          Virtual Office
        </div>

        {info  && <div style={{ color: '#86efac', fontSize: 12, marginBottom: 12 }}>{info}</div>}
        {error && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {step === 'guest_or_login' && (
          <>
            {/* Gast */}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Als Gast betreten
            </div>
            <input
              style={inputStyle}
              type="text"
              placeholder="Dein Name"
              maxLength={50}
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuest()}
              autoFocus
            />
            <button style={btnSecondary} onClick={handleGuest}>
              👤 Als Gast betreten
            </button>

            {/* Trennlinie */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>oder einloggen</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Login */}
            <input
              style={inputStyle}
              type="email"
              placeholder="E-Mail"
              maxLength={100}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="Passwort"
              maxLength={100}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button style={btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ ...' : '🔑 Einloggen / Registrieren'}
            </button>
          </>
        )}

        {step === 'confirm_register' && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>
              Neuer Account – Passwort bestätigen:
            </div>
            <input
              style={inputStyle}
              type="password"
              placeholder="Passwort wiederholen"
              maxLength={100}
              value={repassword}
              onChange={e => setRepassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              autoFocus
            />
            <button style={btnGreen} onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ ...' : '✅ Account erstellen'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
