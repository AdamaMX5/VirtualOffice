export const config = {
  PORT: parseInt(process.env.PORT ?? '3000'),
  AUTH_URL: process.env.AUTH_URL ?? 'https://auth.freischule.info',
  PRESENCE_URL: process.env.PRESENCE_URL ?? 'https://presence.freischule.info',
  PRESENCE_WS_URL: process.env.PRESENCE_WS_URL ?? 'wss://presence.freischule.info',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
} as const;
