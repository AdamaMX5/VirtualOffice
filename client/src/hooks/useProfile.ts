import { useEffect } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useProfileStore } from '../model/stores/profileStore';
import { loadProfile } from '../services/profileClient';
import { presenceSend } from './usePresence';

/** Lädt das Profil des eingeloggten Nutzers beim Login und synchronisiert Name + Avatar. */
export function useProfile() {
  const userId = useAuthStore((s) => s.userId);
  const jwt    = useAuthStore((s) => s.jwt);

  useEffect(() => {
    if (!userId || !jwt) return;
    let cancelled = false;
    loadProfile(userId).then((result) => {
      if (cancelled || !result) return;
      const { profile } = result;
      if (profile.avatarUrl) useProfileStore.getState().setAvatarUrl(profile.avatarUrl);
      const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
      if (displayName) {
        usePlayerStore.getState().setName(displayName);
        presenceSend({ type: 'set_name', name: displayName, department: profile.department || undefined });
      }
    });
    return () => { cancelled = true; };
  }, [userId, jwt]);
}
