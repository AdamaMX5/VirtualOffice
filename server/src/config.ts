export const config = {
  PORT: parseInt(process.env.PORT ?? '3000'),
  AUTH_URL: process.env.AUTH_URL ?? 'https://auth.freischule.info',
  PRESENCE_URL: process.env.PRESENCE_URL ?? 'https://presence.freischule.info',
  PRESENCE_WS_URL: process.env.PRESENCE_WS_URL ?? 'wss://presence.freischule.info',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'https://office.freischule.info',
  LIVEKIT_URL: process.env.LIVEKIT_URL ?? 'https://live.freischule.info',
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? 'devsecret',
} as const;
