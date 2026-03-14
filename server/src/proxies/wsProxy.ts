import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config';

// wss://presence.freischule.info → ws://presence.freischule.info (http-proxy-middleware handles SSL)
const wsTarget = config.PRESENCE_WS_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

export const wsProxy = createProxyMiddleware({
  target: wsTarget,
  changeOrigin: true,
  ws: true,
});
