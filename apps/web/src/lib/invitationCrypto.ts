import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption of the optional delivery address (ADR 0033). AES-256-GCM with the key from
 * `INVITE_EMAIL_KEY` (32 bytes, base64 or base64url). Fails closed: no key, no stored address.
 * The invitation id is bound as additional authenticated data so a ciphertext cannot be moved to
 * another row.
 */
export class MissingEmailKey extends Error {
  public readonly code = 'missing_email_key';
  public constructor() {
    super('INVITE_EMAIL_KEY must be a 32-byte key (base64) to store delivery addresses.');
    this.name = 'MissingEmailKey';
  }
}

export const resolveEmailKey = (env: Record<string, string | undefined> = process.env): Buffer => {
  const raw = env['INVITE_EMAIL_KEY'];
  if (!raw) throw new MissingEmailKey();
  const key = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (key.length !== 32) throw new MissingEmailKey();
  return key;
};

const enc = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const dec = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export const encryptAddress = (
  address: string,
  invitationId: string,
  key: Buffer = resolveEmailKey(),
): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(invitationId));
  const body = Buffer.concat([cipher.update(address, 'utf8'), cipher.final()]);
  return enc(Buffer.concat([iv, cipher.getAuthTag(), body]));
};

export const decryptAddress = (
  cipherText: string,
  invitationId: string,
  key: Buffer = resolveEmailKey(),
): string => {
  const raw = dec(cipherText);
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(invitationId));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
};

const EMAIL_RE = /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,255}$/;
export const isPlausibleEmail = (v: string): boolean => v.length <= 320 && EMAIL_RE.test(v);
