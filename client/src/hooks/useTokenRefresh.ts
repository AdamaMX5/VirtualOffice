import { useEffect } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { apiPost } from '../services/apiClient';
import { AUTH_URL } from '../model/constants';

interface UseTokenRefreshOptions {
  onNewToken: (token: string) => void;
}

export function useTokenRefresh({ onNewToken }: UseTokenRefreshOptions) {
  const jwt       = useAuthStore((s) => s.jwt);
  const setJwt    = useAuthStore((s) => s.setJwt);
  const setStatus = useAuthStore((s) => s.setStatus);
  const openModal = useAuthStore((s) => s.openModal);
  const email     = useAuthStore((s) => s.email);

  useEffect(() => {
    if (!jwt) return;

    const INTERVAL = 10 * 60 * 1000; // 10 Minuten

    const timer = setInterval(async () => {
      try {
        const data = await apiPost<{ accessToken: string }>(`${AUTH_URL}/user/refresh`, {});
        if (data.accessToken) {
          setJwt(data.accessToken, email);
          onNewToken(data.accessToken);
        } else {
          setStatus('session_expired');
          openModal();
        }
      } catch {
        setStatus('session_expired');
        openModal();
      }
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [jwt, email, setJwt, setStatus, openModal, onNewToken]);
}
