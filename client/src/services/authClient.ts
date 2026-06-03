import { useAuthStore } from '../model/stores/authStore';
import { AUTH_URL } from '../model/constants';

/** Seconds until the JWT expires. Negative = already expired. */
export function jwtExpiresInSeconds(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.exp as number) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

/** Reads a cookie value by name. Returns null if the cookie is absent. */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// Deduplicate concurrent refresh requests
let _refreshPromise: Promise<string | null> | null = null;

/** Fetches a new access token from AuthService and stores it in the store. */
async function doRefresh(): Promise<string | null> {
  try {
    // csrf_token is not HttpOnly — JS reads it and sends it as X-CSRF-Token header
    const csrfToken = getCookie('csrf_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const res = await fetch(`${AUTH_URL}/user/refresh`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const token = (data.access_token ?? data.accessToken) as string | undefined;
    if (!token) return null;
    const { email, userId, setJwt } = useAuthStore.getState();
    setJwt(token, email, userId); // keep userId so getJwtUserId() stays stable
    return token;
  } catch {
    return null;
  } finally {
    _refreshPromise = null;
  }
}

/**
 * Returns a valid JWT. If the current token expires within `bufferSeconds`,
 * a refresh is performed first. Concurrent calls share a single request.
 * Throws if no valid token is available.
 */
export async function getFreshJwt(bufferSeconds = 120): Promise<string> {
  const current = useAuthStore.getState().jwt;
  if (!current) throw new Error('Nicht eingeloggt');

  if (jwtExpiresInSeconds(current) > bufferSeconds) {
    return current;
  }

  // Refresh needed — only one request at a time
  _refreshPromise ??= doRefresh();
  const fresh = await _refreshPromise;

  if (fresh) return fresh;

  // Refresh failed — use the existing token if it hasn't expired yet
  const stillValid = useAuthStore.getState().jwt;
  if (stillValid && jwtExpiresInSeconds(stillValid) > 0) return stillValid;

  useAuthStore.getState().openModal();
  throw new Error('Session abgelaufen');
}

/** Logs the user out — invalidates the refresh token on the server and clears local state. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_URL}/user/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch { /* ignored — local state is cleared regardless */ }
  useAuthStore.getState().clearAuth();
}
