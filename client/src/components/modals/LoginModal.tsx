import React, { useRef, useState } from 'react';
import { useAuthStore } from '../../model/stores/authStore';
import { usePlayerStore } from '../../model/stores/playerStore';
import { apiPost } from '../../services/apiClient';
import { AUTH_URL } from '../../model/constants';

type Step = 'email' | 'login' | 'register';

interface AuthResponse {
  access_token: string;
  email: string;
  status?: string;
  id?: string;
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
const inputReadonly: React.CSSProperties = {
  ...inputStyle,
  color: 'rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.02)',
  cursor: 'default',
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
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
  fontSize: 12, cursor: 'pointer', marginTop: 10, textDecoration: 'underline',
};

const LoginModal = () => {
  const closeModal = useAuthStore((s) => s.closeModal);
  const setJwt     = useAuthStore((s) => s.setJwt);
  const setName    = usePlayerStore((s) => s.setName);

  const [step,       setStep]       = useState<Step>('email');
  const [guestName,  setGuestName]  = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [repassword, setRepassword] = useState('');
  const [error,      setError]      = useState('');
  const [info,       setInfo]       = useState('');
  const [loading,    setLoading]    = useState(false);

  const passwordRef   = useRef<HTMLInputElement>(null);
  const repasswordRef = useRef<HTMLInputElement>(null);

  function handleGuest() {
    const name = guestName.trim() || 'Gast';
    setName(name);
    closeModal();
  }

  function finishAuth(data: AuthResponse) {
    setJwt(data.access_token, data.email, data.id);
    setName(data.email);
    closeModal();
  }

  async function handleCheckEmail() {
    if (!email.trim()) { setError('Bitte E-Mail eingeben.'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const data = await apiPost<{ status: string }>(`${AUTH_URL}/user/check-email`, { email });
      if (data.status === 'login') {
        setStep('login');
        setTimeout(() => passwordRef.current?.focus(), 50);
      } else {
        setStep('register');
        setTimeout(() => passwordRef.current?.focus(), 50);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setLoading(false);
  }

  async function handleLogin() {
    setLoading(true); setError(''); setInfo('');
    try {
      const data = await apiPost<AuthResponse>(`${AUTH_URL}/user/login`, {
        email,
        password,
        device_fingerprint: navigator.userAgent,
        device_name: 'Virtual Office Web',
      });
      if (data.status === 'login_with_verify_email_send') {
        setInfo('Eingeloggt! Verifikations-E-Mail wurde gesendet.');
      }
      finishAuth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setLoading(false);
  }

  async function handleRegister() {
    if (password !== repassword) { setError('Passwörter stimmen nicht überein.'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiPost<AuthResponse>(`${AUTH_URL}/user/register-complete`, {
        email,
        password,
        repassword,
        device_fingerprint: navigator.userAgent,
        device_name: 'Virtual Office Web',
      });
      finishAuth(data);
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

        {/* Guest section — always visible */}
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
        />
        <button style={btnSecondary} onClick={handleGuest}>
          👤 Als Gast betreten
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>oder einloggen</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Step: email */}
        {step === 'email' && (
          <>
            <input
              style={inputStyle}
              type="email"
              placeholder="E-Mail"
              maxLength={100}
              value={email}
              autoFocus
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheckEmail()}
            />
            <button style={btnPrimary} onClick={handleCheckEmail} disabled={loading}>
              {loading ? '⏳ ...' : 'Weiter'}
            </button>
          </>
        )}

        {/* Step: login (email known) */}
        {step === 'login' && (
          <>
            <input style={inputReadonly} type="email" value={email} readOnly tabIndex={-1} />
            <input
              ref={passwordRef}
              style={inputStyle}
              type="password"
              placeholder="Passwort"
              maxLength={100}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button style={btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ ...' : '🔑 Einloggen'}
            </button>
            <button style={linkBtn} onClick={() => { setStep('email'); setError(''); setPassword(''); }}>
              Andere E-Mail verwenden
            </button>
          </>
        )}

        {/* Step: register (new email) */}
        {step === 'register' && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
              Neue E-Mail – Account erstellen:
            </div>
            <input style={inputReadonly} type="email" value={email} readOnly tabIndex={-1} />
            <input
              ref={passwordRef}
              style={inputStyle}
              type="password"
              placeholder="Passwort"
              maxLength={100}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && repasswordRef.current?.focus()}
            />
            <input
              ref={repasswordRef}
              style={inputStyle}
              type="password"
              placeholder="Passwort wiederholen"
              maxLength={100}
              value={repassword}
              onChange={e => setRepassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
            <button style={btnGreen} onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ ...' : '✅ Account erstellen'}
            </button>
            <button style={linkBtn} onClick={() => { setStep('email'); setError(''); setPassword(''); setRepassword(''); }}>
              Andere E-Mail verwenden
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
