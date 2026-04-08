import React, { useState } from 'react';
import { useLiveKitStore } from '../../model/stores/liveKitStore';

const ConnectionErrorModal: React.FC = () => {
  const status     = useLiveKitStore((s) => s.status);
  const error      = useLiveKitStore((s) => s.error);
  const errorUrl   = useLiveKitStore((s) => s.errorUrl);
  const errorStack = useLiveKitStore((s) => s.errorStack);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied]       = useState(false);

  // Show only on error, and only if not manually dismissed for this error
  const prevErrorRef = React.useRef<string | null>(null);
  if (status === 'error' && error !== prevErrorRef.current) {
    prevErrorRef.current = error;
    // New error → un-dismiss
    if (dismissed) setDismissed(false);
  }

  if (status !== 'error' || !error || dismissed) return null;

  const ua        = navigator.userAgent;
  const timestamp = new Date().toISOString();

  const reportText = [
    `Zeitstempel: ${timestamp}`,
    `Fehler: ${error}`,
    `URL: ${errorUrl ?? '–'}`,
    `User-Agent: ${ua}`,
    errorStack ? `\nStack:\n${errorStack}` : '',
  ].filter(Boolean).join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#0f0f18',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: 14,
        padding: '20px 22px',
        maxWidth: 520,
        width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        color: '#fff',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔴</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>LiveKit – Verbindungsfehler</span>
        </div>

        {/* Error message */}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 4 }}>Fehlermeldung</div>
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#fca5a5',
            wordBreak: 'break-all',
          }}>
            {error}
          </div>
        </div>

        {/* URL */}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 4 }}>Angefragte URL</div>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            wordBreak: 'break-all',
          }}>
            {errorUrl ?? '–'}
          </div>
        </div>

        {/* Stack trace (collapsed by default) */}
        {errorStack && (
          <details style={{ cursor: 'pointer' }}>
            <summary style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, userSelect: 'none' }}>
              Stack Trace anzeigen
            </summary>
            <pre style={{
              marginTop: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 160,
              overflowY: 'auto',
            }}>
              {errorStack}
            </pre>
          </details>
        )}

        {/* User-Agent */}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 4 }}>User-Agent (Gerät)</div>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            wordBreak: 'break-all',
          }}>
            {ua}
          </div>
        </div>

        {/* Timestamp */}
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
          {timestamp}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 8,
              color: copied ? '#86efac' : '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 14px',
            }}
          >
            {copied ? '✓ Kopiert' : '📋 Fehlerbericht kopieren'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 12,
              padding: '7px 14px',
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionErrorModal;
