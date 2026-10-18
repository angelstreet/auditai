/**
 * Signed session cookie (ADR 0023).
 *
 * Pure WebCrypto so the same module runs in the Edge middleware and in Node server code. The
 * cookie value is `<base64url(payload JSON)>.<base64url(HMAC-SHA256(payload part, secret))>`.
 * No secret lives in the repo: `AUTH_SESSION_SECRET` comes from the environment and the app
 * fails closed (throws) when it is missing outside local development.
 */

export const SESSION_COOKIE = 'evolai_session';
/** Pre-rename cookie name (ADR 0026). Read as a fallback so open sessions survive the rename. */
export const LEGACY_SESSION_COOKIE = 'aai_session';

/** Session cookie value from any cookie getter: the new name first, then the legacy name. */
export const readSessionCookie = (
  get: (name: string) => { value: string } | undefined,
): string | undefined => (get(SESSION_COOKIE) ?? get(LEGACY_SESSION_COOKIE))?.value;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface SessionTenant {
  readonly id: string;
  readonly role: string;
}

export interface SessionPayload {
  /** users.id of the authenticated auditor. */
  readonly sub: string;
  readonly name: string;
  /** Sign-in email, shown in the header account menu (docs/UI_RULES.md §11). Absent on older cookies. */
  readonly email?: string;
  readonly tenants: readonly SessionTenant[];
  /** Seconds since epoch. */
  readonly iat: number;
  readonly exp: number;
}

export class MissingSessionSecret extends Error {
  public readonly code = 'missing_session_secret';
  public constructor() {
    super('AUTH_SESSION_SECRET is not set; refusing to sign or verify sessions');
    this.name = 'MissingSessionSecret';
  }
}

const LOCAL_DEV_SECRET = 'local-dev-only-session-secret-not-for-deploy';

export const resolveSecret = (env: Record<string, string | undefined> = process.env): string => {
  const configured = env['AUTH_SESSION_SECRET'];
  if (configured && configured.length >= 16) return configured;
  if (env['NODE_ENV'] === 'development' || env['NODE_ENV'] === 'test') return LOCAL_DEV_SECRET;
  throw new MissingSessionSecret();
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64Url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = (v: string): Uint8Array => {
  const padded = v.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (v.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const hmacKey = (secret: string, usage: KeyUsage): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ]);

export const signSession = async (
  payload: SessionPayload,
  secret: string = resolveSecret(),
): Promise<string> => {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, 'sign');
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${toB64Url(sig)}`;
};

/** Returns the payload, or null for any malformed, tampered or expired cookie. */
export const verifySession = async (
  value: string | undefined | null,
  secret: string = resolveSecret(),
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> => {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  try {
    const key = await hmacKey(secret, 'verify');
    // crypto.subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify('HMAC', key, fromB64Url(sig), enc.encode(body));
    if (!ok) return null;
    const parsed = JSON.parse(dec.decode(fromB64Url(body))) as Partial<SessionPayload>;
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.iat !== 'number' ||
      !Array.isArray(parsed.tenants) ||
      parsed.exp <= nowSeconds
    ) {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
};

export const newSessionPayload = (
  user: { id: string; name: string; email?: string },
  tenants: readonly SessionTenant[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionPayload => ({
  sub: user.id,
  name: user.name,
  ...(user.email ? { email: user.email.trim().toLowerCase() } : {}),
  tenants,
  iat: nowSeconds,
  exp: nowSeconds + SESSION_TTL_SECONDS,
});

export const sessionCookieOptions = (): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
} => ({
  httpOnly: true,
  sameSite: 'lax',
  // Secure in production; the local runner and Playwright opt out with AUTH_COOKIE_SECURE=0.
  secure: process.env['AUTH_COOKIE_SECURE'] !== '0' && process.env['NODE_ENV'] === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});
