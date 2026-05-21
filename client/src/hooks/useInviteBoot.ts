/**
 * useInviteBoot – liest den ?invite=TOKEN aus der URL, holt Einladungsdaten
 * vom Server und setzt den Gastnamen automatisch, ohne das Login-Modal zu zeigen.
 * Läuft einmalig beim App-Start.
 */
import { useEffect } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useAuthStore } from '../model/stores/authStore';
import { useGuestWaitStore } from '../model/stores/guestWaitStore';

const _inviteToken = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('invite')
  : null;

interface InviteInfo {
  status:          'valid' | 'too_early';
  guestName:       string;
  inviterName:     string;
  roomId:          string | null;
  appointmentTime: number | null;
}

export function useInviteBoot(): void {
  useEffect(() => {
    if (!_inviteToken) return;
    const jwt = useAuthStore.getState().jwt;
    if (jwt) return; // Eingeloggte User brauchen keinen Auto-Namen

    // Modal sofort schließen — Gast bekommt Namen aus der Einladung
    useAuthStore.getState().closeModal();

    fetch(`/api/invite/${encodeURIComponent(_inviteToken)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : 'error');
        return r.json() as Promise<InviteInfo>;
      })
      .then((info) => {
        if (info.status === 'too_early' && info.appointmentTime) {
          // Termin liegt noch in der Zukunft — Wartescreen zeigen (kein Login-Modal)
          useGuestWaitStore.getState().setTooEarlyInfo({
            guestName:       info.guestName,
            inviterName:     info.inviterName,
            appointmentTime: info.appointmentTime,
          });
          return;
        }
        const name = info.guestName || 'Gast';
        usePlayerStore.getState().setName(name);
      })
      .catch(() => {
        // Token unbekannt oder abgelaufen → normales Modal zeigen
        useAuthStore.getState().openModal();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
