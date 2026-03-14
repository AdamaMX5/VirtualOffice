import http from 'http';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';

import { config } from './config';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { buildContext, type ApolloContext } from './graphql/context';
import { wsProxy } from './proxies/wsProxy';

async function main() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────
  app.use(cookieParser());
  app.use(cors({
    origin: config.CLIENT_ORIGIN,
    credentials: true,
  }));
  app.use(express.json());

  // ── WebSocket-Proxy für PresenceService (/ws) ─────────────────
  app.use('/ws', wsProxy);

  // ── Apollo Server (GraphQL) ───────────────────────────────────
  const apolloServer = new ApolloServer<ApolloContext>({ typeDefs, resolvers });
  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => buildContext({ req, res }),
    })
  );

  // ── Static Client Build ───────────────────────────────────────
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  // ── HTTP-Server mit WS-Upgrade-Unterstützung ──────────────────
  const httpServer = http.createServer(app);

  // http-proxy-middleware braucht den raw http.Server für WS-Upgrades
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpServer.on('upgrade', (wsProxy as any).upgrade);

  httpServer.listen(config.PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${config.PORT}`);
    console.log(`📡 GraphQL:   http://localhost:${config.PORT}/graphql`);
    console.log(`🔌 WS-Proxy:  ws://localhost:${config.PORT}/ws → ${config.PRESENCE_WS_URL}/ws`);
  });
}

main().catch(err => {
  console.error('Server-Fehler:', err);
  process.exit(1);
});
