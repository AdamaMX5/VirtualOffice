import React, { useEffect, useState } from 'react';
import { useServiceStatusStore } from '../../model/stores/serviceStatusStore';

interface ServiceStatus {
  name:     string;
  status:   'ok' | 'degraded' | 'error' | 'unknown';
  latency?: number;
  message?: string;
}

interface StatusResponse {
  services: ServiceStatus[];
}

const STATUS_COLOR: Record<ServiceStatus['status'], string> = {
  ok:       '#22c55e',
  degraded: '#f59e0b',
  error:    '#ef4444',
  unknown:  '#64748b',
};

const STATUS_LABEL: Record<ServiceStatus['status'], string> = {
  ok:       'OK',
  degraded: 'DEGRADED',
  error:    'ERROR',
  unknown:  'UNKNOWN',
};

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.80)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  } as React.CSSProperties,

  card: {
    background: '#0f172a',
    border: '1px solid rgba(99,179,237,0.2)',
    borderRadius: 16,
    padding: 28,
    width: 480,
    maxWidth: '95vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,179,237,0.05)',
    overflowY: 'auto' as const,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  dot: {
    width: 8, height: 8,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 6px #22c55e',
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: '0.02em',
  },

  closeBtn: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 15,
    cursor: 'pointer',
    padding: '4px 10px',
  },

  table: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },

  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    gap: 16,
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  serviceName: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#cbd5e1',
    fontWeight: 600,
  },

  latency: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    textAlign: 'right' as const,
  },

  badge: (status: ServiceStatus['status']) => ({
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '0.06em',
    color: STATUS_COLOR[status],
    padding: '2px 8px',
    borderRadius: 4,
    border: `1px solid ${STATUS_COLOR[status]}40`,
    background: `${STATUS_COLOR[status]}10`,
  }),

  message: {
    gridColumn: '1 / -1',
    fontSize: 11,
    color: '#64748b',
    marginTop: -2,
  },

  notice: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center' as const,
    padding: '24px 0',
    lineHeight: 1.7,
  },

  refreshBtn: {
    alignSelf: 'center',
    background: 'rgba(99,179,237,0.08)',
    border: '1px solid rgba(99,179,237,0.2)',
    borderRadius: 8,
    color: '#63b3ed',
    fontSize: 12,
    cursor: 'pointer',
    padding: '6px 18px',
  },
};

const ServiceStatusModal: React.FC = () => {
  const { isOpen, close } = useServiceStatusStore();
  const [data,    setData]    = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    setError(null);
    fetch('/api/services/status')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatusResponse>;
      })
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) fetchStatus();
    else { setData(null); setError(null); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={S.card}>

        <div style={S.header}>
          <div style={S.titleGroup}>
            <div style={S.dot} />
            <h2 style={S.title}>Service Status</h2>
          </div>
          <button style={S.closeBtn} onClick={close}>✕</button>
        </div>

        {loading && (
          <p style={S.notice}>Lade Service-Status…</p>
        )}

        {!loading && error && (
          <>
            <p style={{ ...S.notice, color: '#ef4444' }}>
              Endpoint noch nicht verfügbar.<br />
              <span style={{ color: '#475569' }}>{error}</span>
            </p>
            <button style={S.refreshBtn} onClick={fetchStatus}>Erneut versuchen</button>
          </>
        )}

        {!loading && data && (
          <>
            <div style={S.table}>
              {data.services.map((svc) => (
                <div key={svc.name} style={S.row}>
                  <span style={S.serviceName}>{svc.name}</span>
                  <span style={S.latency}>
                    {svc.latency != null ? `${svc.latency} ms` : '—'}
                  </span>
                  <span style={S.badge(svc.status)}>{STATUS_LABEL[svc.status]}</span>
                  {svc.message && (
                    <span style={S.message}>{svc.message}</span>
                  )}
                </div>
              ))}
            </div>
            <button style={S.refreshBtn} onClick={fetchStatus}>Aktualisieren</button>
          </>
        )}

      </div>
    </div>
  );
};

export default ServiceStatusModal;
