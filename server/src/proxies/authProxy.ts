import { config } from '../config';

interface ProxyResult {
  data: unknown;
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
    data: await res.json(),
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}

export async function proxyRegister(
  email: string,
  repassword: string
): Promise<ProxyResult> {
  const res = await fetch(`${config.AUTH_URL}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, repassword }),
  });
  return {
    data: await res.json(),
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}

export async function proxyRefresh(incomingCookie?: string): Promise<ProxyResult> {
  const res = await fetch(`${config.AUTH_URL}/user/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(incomingCookie ? { cookie: incomingCookie } : {}),
    },
  });
  return {
    data: await res.json(),
    setCookie: res.headers.get('set-cookie'),
    status: res.status,
  };
}
