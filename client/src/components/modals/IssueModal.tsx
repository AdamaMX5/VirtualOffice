import React, { useState, useCallback, useEffect } from 'react';
import { useIssueModalStore } from '../../model/stores/issueModalStore';
import { useAuthStore } from '../../model/stores/authStore';
import { listRepos, createIssue, GitRepo } from '../../services/gitClient';

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 3000,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16, padding: 28,
    width: 480, maxWidth: '95vw',
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: '#e2e8f0' },
  label: { display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5 },
  input: {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '9px 12px',
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
    resize: 'vertical' as const, minHeight: 100,
    fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: 10 },
  btnPrimary: {
    flex: 1, padding: '10px 0',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  },
  checkboxRow: {
    display: 'flex', gap: 16, flexWrap: 'wrap' as const,
  },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  },
  success: {
    padding: '10px 14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 8, color: '#86efac', fontSize: 13, textAlign: 'center' as const,
  },
  successLink: {
    color: '#7dd3fc', textDecoration: 'underline',
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 8, color: '#fca5a5', fontSize: 13,
  },
};

const AVAILABLE_LABELS = ['bug', 'Verbesserung', 'Frage'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

const IssueModal: React.FC = () => {
  const { isOpen, close } = useIssueModalStore();
  const jwt               = useAuthStore((s) => s.jwt);

  const [repos,          setRepos]          = useState<GitRepo[]>([]);
  const [reposLoading,   setReposLoading]   = useState(false);
  const [selectedRepo,   setSelectedRepo]   = useState('');
  const [issueTitle,     setIssueTitle]     = useState('');
  const [issueBody,      setIssueBody]      = useState('');
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [created,        setCreated]        = useState<{ number: number; url: string } | null>(null);

  // Load repos when modal opens
  useEffect(() => {
    if (!isOpen || !jwt) return;
    setReposLoading(true);
    listRepos(jwt)
      .then((data) => {
        setRepos(data);
        if (data.length > 0) setSelectedRepo(data[0].name);
      })
      .catch(() => setError('Repositories konnten nicht geladen werden.'))
      .finally(() => setReposLoading(false));
  }, [isOpen, jwt]);

  const handleClose = useCallback(() => {
    setRepos([]);
    setSelectedRepo('');
    setIssueTitle('');
    setIssueBody('');
    setSelectedLabels(new Set());
    setLoading(false);
    setError('');
    setCreated(null);
    close();
  }, [close]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  const toggleLabel = useCallback((label: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!jwt) return;
    if (!selectedRepo) { setError('Bitte ein Repository auswählen.'); return; }
    if (!issueTitle.trim()) { setError('Bitte einen Titel eingeben.'); return; }
    if (!issueBody.trim()) { setError('Bitte eine Beschreibung eingeben.'); return; }

    setLoading(true);
    setError('');
    try {
      const labels = selectedLabels.size > 0 ? Array.from(selectedLabels) : undefined;
      const result = await createIssue(jwt, selectedRepo, issueTitle.trim(), issueBody.trim(), labels);
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Issues.');
    } finally {
      setLoading(false);
    }
  }, [jwt, selectedRepo, issueTitle, issueBody, selectedLabels]);

  // Not logged in or closed — render nothing
  if (!isOpen || !jwt) return null;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={S.card}>
        <h2 style={S.title}>💡 Verbesserung vorschlagen</h2>

        {/* Repository selection */}
        <div>
          <label style={S.label}>Repository *</label>
          <select
            style={S.select}
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            disabled={reposLoading || !!created}
          >
            {reposLoading && <option value="">Lädt…</option>}
            {!reposLoading && repos.length === 0 && (
              <option value="">Keine Repositories gefunden</option>
            )}
            {repos.map((r) => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Issue title */}
        <div>
          <label style={S.label}>Titel *</label>
          <input
            style={S.input}
            type="text"
            placeholder="Kurze Zusammenfassung des Problems oder der Idee"
            maxLength={200}
            value={issueTitle}
            onChange={(e) => { setIssueTitle(e.target.value); setError(''); }}
            disabled={!!created}
            autoFocus
          />
        </div>

        {/* Issue body */}
        <div>
          <label style={S.label}>Beschreibung *</label>
          <textarea
            style={S.textarea}
            placeholder="Detaillierte Beschreibung, Schritte zur Reproduktion, erwartetes Verhalten…"
            maxLength={5000}
            value={issueBody}
            onChange={(e) => { setIssueBody(e.target.value); setError(''); }}
            disabled={!!created}
          />
        </div>

        {/* Labels */}
        <div>
          <label style={S.label}>Labels (optional)</label>
          <div style={S.checkboxRow}>
            {AVAILABLE_LABELS.map((label) => (
              <label key={label} style={S.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedLabels.has(label)}
                  onChange={() => toggleLabel(label)}
                  disabled={!!created}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && <div style={S.error}>{error}</div>}

        {/* Success message */}
        {created && (
          <div style={S.success}>
            Issue #{created.number} erstellt ✅{' '}
            <a
              href={created.url}
              target="_blank"
              rel="noopener noreferrer"
              style={S.successLink}
            >
              Auf GitHub öffnen
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div style={S.row}>
          {!created && (
            <button
              style={{ ...S.btnPrimary, opacity: loading || reposLoading ? 0.6 : 1 }}
              onClick={handleSubmit}
              disabled={loading || reposLoading}
            >
              {loading ? '⏳ Erstelle…' : '💡 Issue erstellen'}
            </button>
          )}
          <button style={S.btnSecondary} onClick={handleClose}>
            {created ? 'Schließen' : 'Abbrechen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueModal;
