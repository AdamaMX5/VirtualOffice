import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../model/stores/playerStore';
import { useCameraStore } from '../../model/stores/cameraStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { presenceSend } from '../../hooks/usePresence';
import { P } from '../../model/constants';

const BUBBLE_DURATION_MS = 5000;

const ChatInput: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { wx, wy } = usePlayerStore();
  const { scale, offset } = useCameraStore();

  // Screen-Position des eigenen Avatars
  const screenX = wx * P * scale + offset.x;
  const screenY = wy * P * scale + offset.y;

  // Enter-Taste (nicht in Input/Textarea/Button) öffnet das Eingabefeld
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Fokus sobald geöffnet
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setText('');
  }, []);

  const send = useCallback(() => {
    const body = text.trim();
    close();
    if (!body) return;

    // An alle Clients senden
    presenceSend({ type: 'chat', text: body });

    // Eigene Sprechblase sofort anzeigen (optimistisch, Schlüssel '__self__')
    const store = usePresenceStore.getState();
    store.setChatBubble('__self__', body);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => usePresenceStore.getState().clearChatBubble('__self__'),
      BUBBLE_DURATION_MS,
    );
  }, [text, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  };

  if (!open) return null;

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={close}
      maxLength={120}
      placeholder="Nachricht… (Enter = senden)"
      style={{
        position: 'fixed',
        left: Math.round(screenX - 90),
        top: Math.round(screenY - 80),
        width: 180,
        background: 'rgba(255,255,255,0.96)',
        border: '2px solid #4f8ef7',
        borderRadius: 10,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 600,
        color: '#1e293b',
        outline: 'none',
        zIndex: 200,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        textAlign: 'center',
        pointerEvents: 'all',
      }}
    />
  );
};

export default ChatInput;
