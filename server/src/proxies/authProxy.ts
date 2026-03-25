import { config } from '../config';

interface RawAuthResponse {
  access_token?: string;
  accessToken?: string;
  email?: string;
  status?: string;
  id?: string;
  detail?: unknown;
}

interface ProxyResult {
  data: RawAuthResponse;
  setCookie: string | null;
  status: number;
}

export async function proxyLogin(
  email: string,
  password: string,
  deviceFingerprint?: string,
  deviceName?: string
): Promise<ProxyResult> {
  const res = await fetch(`${config.AUTH_URL}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: deviceFingerprint ?? '',
      device_name: deviceName ?? 'Virtual Office Web',
    }),
  });
  return {
    data: await res.json() as RawAuthResponse,
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}

export async function proxyRegister(
  userid: string,
  repassword: string
): Promise<ProxyResult> {
  const res = await fetch(`${config.AUTH_URL}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, repassword }),
  });
  return {
    data: await res.json() as RawAuthResponse,
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}

export async function proxyRefresh(incomingCookie?: string): Promise<ProxyResult> {
  const res = await fetch(`${config.AUTH_URL}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(incomingCookie ? { cookie: incomingCookie } : {}),
    },
  });
  return {
    data: await res.json() as RawAuthResponse,
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}

/** Normalisiert snake_case → camelCase für den Client */
export function normalizeAuth(raw: RawAuthResponse) {
  return {
    accessToken: (raw.access_token ?? raw.accessToken) as string,
    email:       raw.email ?? '',
    status:      raw.status,
    id:          raw.id,
  };
}
