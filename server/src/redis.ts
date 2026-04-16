import Redis from 'ioredis';
import { config } from './config';

/** Pub-Client – für PUBLISH und alle normalen Redis-Befehle (HSET, DEL, SCAN, …). */
export const redisPub = new Redis(config.REDIS_URL);

/** Sub-Client – ausschließlich für SUBSCRIBE (ein subscribter Client kann nicht mehr publishen). */
export const redisSub = new Redis(config.REDIS_URL);

redisPub.on('error', (err) => console.error('[Redis] Pub-Fehler:', err.message));
redisSub.on('error', (err) => console.error('[Redis] Sub-Fehler:', err.message));
redisPub.on('ready', () => console.log('[Redis] Pub verbunden mit', config.REDIS_URL));
redisSub.on('ready', () => console.log('[Redis] Sub verbunden mit', config.REDIS_URL));
