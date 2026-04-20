import { useEffect } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { getFreshJwt } from '../services/authClient';

interface UseTokenRefreshOptions {
  onNewToken: (token: string) => void;
}

export function useTokenRefresh({ onNewToken }: UseTokenRefreshOptions) {
  const jwt    = useAuthStore((s) => s.jwt);
  const email  = useAuthStore((s) => s.email);

  useEffect(() => {
    if (!jwt) return;

    // Alle 60s prüfen; getFreshJwt() refresht nur wenn < 2 Min. verbleiben
    const timer = setInterval(async () => {
      try {
        const fresh = await getFreshJwt();
        if (fresh !== useAuthStore.getState().jwt) {
          // Token wurde erneuert → WS informieren
          onNewToken(fresh);
        }
      } catch {
        // getFreshJwt() öffnet das Modal selbst wenn wirklich abgelaufen
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, [jwt, email, onNewToken]);
}
