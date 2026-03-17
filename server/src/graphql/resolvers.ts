import { GraphQLError } from 'graphql';
import { AccessToken } from 'livekit-server-sdk';
import type { ApolloContext } from './context';
import { proxyLogin, proxyRegister, proxyRefresh } from '../proxies/authProxy';
import { config } from '../config';

// Hilfsfunktion: access_token → accessToken (camelCase)
function normalizeAuthPayload(data: Record<string, unknown>) {
  return {
    accessToken: (data.access_token ?? data.accessToken) as string,
    email: data.email as string,
    status: data.status as string | undefined,
    id: data.id as string | undefined,
  };
}

export const resolvers = {
  Query: {
    presenceHealth: async () => {
      try {
        const res = await fetch(`${config.PRESENCE_URL}/health`, { method: 'GET' });
        if (res.ok) {
          return { ok: true };
        }
        return { ok: false, message: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, message: String(err) };
      }
    },
    clientConfig: () => ({
      presenceWsUrl: config.PRESENCE_WS_URL,
    }),
  },

  Mutation: {
    login: async (
      _: unknown,
      args: { email: string; password: string; deviceFingerprint?: string; deviceName?: string },
      context: ApolloContext
    ) => {
      const { data, setCookie, status } = await proxyLogin(
        args.email,
        args.password,
        args.deviceFingerprint,
        args.deviceName
      );

      const payload = data as Record<string, unknown>;

      if (status >= 400) {
        const detail = Array.isArray(payload.detail)
          ? (payload.detail as Array<{ msg: string }>).map(d => d.msg).join(', ')
          : String(payload.detail ?? 'Login fehlgeschlagen');
        throw new GraphQLError(detail, { extensions: { code: 'UNAUTHORIZED' } });
      }

      // httponly Refresh-Cookie an Browser weiterleiten
      if (setCookie) {
        context.res.setHeader('Set-Cookie', setCookie);
      }

      return normalizeAuthPayload(payload);
    },

    register: async (
      _: unknown,
      args: { email: string; repassword: string },
      context: ApolloContext
    ) => {
      const { data, setCookie, status } = await proxyRegister(args.email, args.repassword);
      const payload = data as Record<string, unknown>;

      if (status >= 400) {
        const detail = Array.isArray(payload.detail)
          ? (payload.detail as Array<{ msg: string }>).map(d => d.msg).join(', ')
          : String(payload.detail ?? 'Registrierung fehlgeschlagen');
        throw new GraphQLError(detail, { extensions: { code: 'BAD_USER_INPUT' } });
      }

      if (setCookie) {
        context.res.setHeader('Set-Cookie', setCookie);
      }

      return normalizeAuthPayload(payload);
    },

    refresh: async (
      _: unknown,
      __: unknown,
      context: ApolloContext
    ) => {
      const incomingCookie = context.req.headers.cookie;
      const { data, setCookie, status } = await proxyRefresh(incomingCookie);
      const payload = data as Record<string, unknown>;

      if (status >= 400) {
        throw new GraphQLError('Session abgelaufen', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      if (setCookie) {
        context.res.setHeader('Set-Cookie', setCookie);
      }

      return {
        accessToken: (payload.access_token ?? payload.accessToken) as string,
      };
    },

    livekitToken: async (
      _: unknown,
      args: { room: string; identity: string; name?: string },
    ) => {
      if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
        throw new GraphQLError('LiveKit nicht konfiguriert (API Key/Secret fehlen)', {
          extensions: { code: 'CONFIGURATION_ERROR' },
        });
      }

      const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
        identity: args.identity,
        name: args.name ?? args.identity,
        ttl: '1h',
      });
      at.addGrant({
        roomJoin: true,
        room: args.room,
        canPublish: true,
        canSubscribe: true,
      });

      const token = await at.toJwt();
      return { token, url: config.LIVEKIT_URL };
    },
  },
};
