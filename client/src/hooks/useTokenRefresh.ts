import { useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useAuthStore } from '../model/stores/authStore';
import { REFRESH_MUTATION } from '../services/authOperations';

interface RefreshResult {
  refresh: { accessToken: string };
}

interface UseTokenRefreshOptions {
  onNewToken: (token: string) => void;
}

export function useTokenRefresh({ onNewToken }: UseTokenRefreshOptions) {
  const jwt         = useAuthStore((s) => s.jwt);
  const setJwt      = useAuthStore((s) => s.setJwt);
  const setStatus   = useAuthStore((s) => s.setStatus);
  const openModal   = useAuthStore((s) => s.openModal);
  const email       = useAuthStore((s) => s.email);

  const [refreshMutation] = useMutation<RefreshResult>(REFRESH_MUTATION);

  useEffect(() => {
    if (!jwt) return;

    const INTERVAL = 10 * 60 * 1000; // 10 Minuten

    const timer = setInterval(async () => {
      try {
        const { data } = await refreshMutation();
        if (data?.refresh?.accessToken) {
          const newToken = data.refresh.accessToken;
          setJwt(newToken, email);
          onNewToken(newToken);
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
  }, [jwt, email, refreshMutation, setJwt, setStatus, openModal, onNewToken]);
}
