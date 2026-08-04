// Missing LIVEKIT_API_KEY/SECRET silently falls back to these placeholders, which
// LiveKit rejects with "invalid API key" — surfaced to the client only as a generic
// "could not establish signal connection". Track whether the fallback was used so
// callers can fail fast with an actionable message instead (see getLiveKitConfigError).
const LIVEKIT_API_KEY_SET    = !!process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET_SET = !!process.env.LIVEKIT_API_SECRET;

export const config = {
  PORT:              parseInt(process.env.PORT ?? '3000'),
  AUTH_URL:          process.env.AUTH_URL          ?? 'https://auth.freischule.info',
  OBJECT_URL:        process.env.OBJECT_URL        ?? 'https://object.freischule.info',
  CLIENT_ORIGIN:     process.env.CLIENT_ORIGIN     ?? 'https://office.freischule.info',
  LIVEKIT_URL:       process.env.LIVEKIT_URL        ?? 'https://live.freischule.info',
  LIVEKIT_API_KEY:   process.env.LIVEKIT_API_KEY    ?? 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? 'devsecret',
  REDIS_URL:         process.env.REDIS_URL          ?? 'redis://localhost:6379',
  ADMIN_URL:         process.env.ADMIN_URL          ?? 'https://admin.freischule.info',
} as const;

/**
 * `null` when LIVEKIT_API_KEY and LIVEKIT_API_SECRET are both set to real values.
 * Otherwise a human-readable message naming which variable is missing and which
 * placeholder it silently fell back to.
 */
export function getLiveKitConfigError(): string | null {
  const missing: string[] = [];
  if (!LIVEKIT_API_KEY_SET)    missing.push(`LIVEKIT_API_KEY ist nicht gesetzt (fällt auf Platzhalter '${config.LIVEKIT_API_KEY}' zurück)`);
  if (!LIVEKIT_API_SECRET_SET) missing.push(`LIVEKIT_API_SECRET ist nicht gesetzt (fällt auf Platzhalter '${config.LIVEKIT_API_SECRET}' zurück)`);
  if (missing.length === 0) return null;
  return `LiveKit nicht konfiguriert: ${missing.join('; ')}.`;
}
