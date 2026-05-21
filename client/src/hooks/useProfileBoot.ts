import { useEffect } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { loadProfile } from '../services/profileClient';

/**
 * Lädt das eigene Profil beim Login automatisch und setzt Name, Abteilung
 * und Berufsbezeichnung im playerStore. Das Ändern des Namens triggert in
 * usePresence einen WS-Reconnect, der dann dept+title mit sendet.
 */
export function useProfileBoot(): void {
  const jwt    = useAuthStore((s) => s.jwt);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!jwt || !userId) return;

    loadProfile(userId)
      .then((res) => {
        if (!res) return;
        const { firstName, lastName, department, title } = res.profile;
        const displayName = [firstName, lastName].filter(Boolean).join(' ');

        usePlayerStore.getState().setDepartment(department || '');
        usePlayerStore.getState().setTitle(title || '');

        if (displayName) {
          usePlayerStore.getState().setName(displayName);
        }
      })
      .catch(() => {});
  }, [jwt, userId]);
}
