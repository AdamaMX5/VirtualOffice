import { useAuthStore } from '../model/stores/authStore';
import { AUTH_URL } from '../model/constants';

/** Sekunden bis der JWT abläuft. Negativ = bereits abgelaufen. */
export function jwtExpiresInSeconds(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.exp as number) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

// Laufende Refresh-Anfrage deduplizieren
let _refreshPromise: Promise<string | null> | null = null;

/** Holt einen neuen Token vom AuthService und speichert ihn im Store. */
async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${AUTH_URL}/user/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const token = (data.access_token ?? data.accessToken) as string | undefined;
    if (!token) return null;
    const { email, userId, setJwt } = useAuthStore.getState();
    setJwt(token, email, userId); // userId beibehalten damit getJwtUserId() stabil bleibt
    return token;
  } catch {
    return null;
  } finally {
    _refreshPromise = null;
  }
}

/**
 * Gibt ein gültiges JWT zurück. Wenn das aktuelle Token in weniger als
 * `bufferSeconds` Sekunden abläuft, wird vorher automatisch ein Refresh
 * durchgeführt. Mehrere gleichzeitige Aufrufe teilen sich einen Request.
 * Wirft einen Fehler wenn kein gültiger Token verfügbar ist.
 */
export async function getFreshJwt(bufferSeconds = 120): Promise<string> {
  const current = useAuthStore.getState().jwt;
  if (!current) throw new Error('Nicht eingeloggt');

  if (jwtExpiresInSeconds(current) > bufferSeconds) {
    return current;
  }

  // Refresh nötig — nur einen Request gleichzeitig
  _refreshPromise ??= doRefresh();
  const fresh = await _refreshPromise;

  if (fresh) return fresh;

  // Refresh fehlgeschlagen — wenn der Token noch nicht abgelaufen ist, weiter nutzen
  const stillValid = useAuthStore.getState().jwt;
  if (stillValid && jwtExpiresInSeconds(stillValid) > 0) return stillValid;

  useAuthStore.getState().openModal();
  throw new Error('Session abgelaufen');
}

/** Meldet den User ab — invalidiert den Refresh-Token auf dem Server und löscht den lokalen State. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_URL}/user/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch { /* ignoriert — lokaler State wird trotzdem gelöscht */ }
  useAuthStore.getState().clearAuth();
}
