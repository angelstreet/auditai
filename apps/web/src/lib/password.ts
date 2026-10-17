import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for the pluggable password provider (ADR 0023). Format:
 * `scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>`. Parameters live in the string so they can be
 * raised later without a migration.
 */

const KEYLEN = 32;
const DEFAULTS = { N: 16384, r: 8, p: 1 } as const;

const derive = (password: string, salt: Buffer, N: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N, r, p }, (err, key) => (err ? reject(err) : resolve(key)));
  });

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await derive(password, salt, DEFAULTS.N, DEFAULTS.r, DEFAULTS.p);
  return `scrypt$${DEFAULTS.N}$${DEFAULTS.r}$${DEFAULTS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64');
  try {
    const actual = await derive(password, Buffer.from(saltB64, 'base64'), +n, +r, +p);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
