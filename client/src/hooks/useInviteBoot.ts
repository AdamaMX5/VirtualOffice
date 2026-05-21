/**
 * useInviteBoot – liest den ?invite=TOKEN aus der URL, holt Einladungsdaten
 * direkt vom ObjectService und setzt den Gastnamen automatisch, ohne das
 * Login-Modal zu zeigen. Läuft einmalig beim App-Start.
 */
import { useEffect } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useAuthStore } from '../model/stores/authStore';
import { useGuestWaitStore } from '../model/stores/guestWaitStore';
import { listObjects } from '../services/objectClient';

const _inviteToken = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('invite')
  : null;

const EARLY_WINDOW_MS = 15 * 60 * 1000;

export function useInviteBoot(): void {
  useEffect(() => {
    if (!_inviteToken) return;
    const jwt = useAuthStore.getState().jwt;
    if (jwt) return; // Eingeloggte User brauchen keinen Auto-Namen

    // Modal sofort schließen — Gast bekommt Namen aus der Einladung
    useAuthStore.getState().closeModal();

    listObjects('invitations', { 'ref[token]': _inviteToken, app: 'VirtualOffice' })
      .then((docs) => {
        if (docs.length === 0) throw new Error('not_found');
        const d = docs[0].data;
        const expiresAt = Number(d.expiresAt ?? 0);
        if (Date.now() > expiresAt) throw new Error('expired');

        const appointmentTime = d.appointmentTime ? Number(d.appointmentTime) : null;
        const guestName       = String(d.guestName   ?? 'Gast');
        const inviterName     = String(d.inviterName  ?? '');

        if (appointmentTime && Date.now() < appointmentTime - EARLY_WINDOW_MS) {
          useGuestWaitStore.getState().setTooEarlyInfo({
            guestName, inviterName, appointmentTime,
          });
          return;
        }

        usePlayerStore.getState().setName(guestName || 'Gast');
      })
      .catch(() => {
        // Token unbekannt oder abgelaufen → normales Modal zeigen
        useAuthStore.getState().openModal();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
