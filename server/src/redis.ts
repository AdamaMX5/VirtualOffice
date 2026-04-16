import Redis from 'ioredis';
import { config } from './config';

/** Pub-Client – für PUBLISH und alle normalen Redis-Befehle (HSET, DEL, SCAN, …). */
export const redisPub = new Redis(config.REDIS_URL, { lazyConnect: true });

/** Sub-Client – ausschließlich für SUBSCRIBE (ein subscribter Client kann nicht mehr publishen). */
export const redisSub = new Redis(config.REDIS_URL, { lazyConnect: true });

redisPub.on('error', (err) => console.error('[Redis] Pub-Fehler:', err.message));
redisSub.on('error', (err) => console.error('[Redis] Sub-Fehler:', err.message));

export async function connectRedis(): Promise<void> {
  await Promise.all([redisPub.connect(), redisSub.connect()]);
  console.log('[Redis] Verbunden mit', config.REDIS_URL);
}
