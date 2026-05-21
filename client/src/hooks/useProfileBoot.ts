import { useEffect } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useProfileStore } from '../model/stores/profileStore';
import { loadProfile } from '../services/profileClient';

export function useProfileBoot(): void {
  const jwt    = useAuthStore((s) => s.jwt);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!jwt || !userId) return;

    loadProfile(userId)
      .then((res) => {
        if (!res) return;
        const { firstName, lastName, department, title, avatarUrl } = res.profile;
        const displayName = [firstName, lastName].filter(Boolean).join(' ');

        usePlayerStore.getState().setDepartment(department || '');
        usePlayerStore.getState().setTitle(title || '');
        useProfileStore.getState().setAvatarUrl(avatarUrl || null);

        if (displayName) {
          usePlayerStore.getState().setName(displayName);
        }
      })
      .catch(() => {});
  }, [jwt, userId]);
}
