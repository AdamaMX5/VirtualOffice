export const config = {
  PORT:              parseInt(process.env.PORT ?? '3000'),
  AUTH_URL:          process.env.AUTH_URL          ?? 'https://auth.freischule.info',
  CLIENT_ORIGIN:     process.env.CLIENT_ORIGIN     ?? 'https://office.freischule.info',
  LIVEKIT_URL:       process.env.LIVEKIT_URL        ?? 'https://live.freischule.info',
  LIVEKIT_API_KEY:   process.env.LIVEKIT_API_KEY    ?? 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? 'devsecret',
  REDIS_URL:         process.env.REDIS_URL          ?? 'redis://localhost:6379',
  ADMIN_URL:         process.env.ADMIN_URL          ?? 'https://admin.freischule.info',
} as const;
