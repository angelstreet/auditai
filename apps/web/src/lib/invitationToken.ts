import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Secure invite token (PRD \u00a75, \u00a716).
 *
 * The token is two parts separated by `.`:
 *   - `reference`: opaque to humans, identifies the invitation row.
 *   - `signature`: HMAC-SHA256(reference, SIGNING_SECRET), base64url.
 *
 * The signature protects against URL guessing and lets the server reject tampered links without
 * touching the database. The signing secret is read from `SURVEY_SIGNING_SECRET`; a default is
 * used in development so the app boots without env wiring, but production deployments must set it.
 */

const DEFAULT_DEV_SECRET = 'dev-only-survey-signing-secret-change-me';

const getSecret = (): string => process.env['SURVEY_SIGNING_SECRET'] ?? DEFAULT_DEV_SECRET;

export interface ParsedToken {
  readonly reference: string;
  readonly signature: string;
}

const TOKEN_REGEX = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{32,256})$/;

/** Parse the URL-safe token. Throws `InvalidInviteToken` on a malformed value. */
export const parseInviteToken = (raw: string): ParsedToken => {
  const match = TOKEN_REGEX.exec(raw);
  if (!match) throw new InvalidInviteToken('malformed token');
  const [, reference, sig] = match as unknown as [string, string, string];
  return { reference, signature: sig };
};

export class InvalidInviteToken extends Error {
  public readonly code = 'invalid_invite_token';
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidInviteToken';
  }
}

export class ExpiredInviteToken extends Error {
  public readonly code = 'expired_invite_token';
  public constructor(public readonly expiresAt: Date) {
    super(`invitation expired at ${expiresAt.toISOString()}`);
    this.name = 'ExpiredInviteToken';
  }
}

export class RevokedInviteToken extends Error {
  public readonly code = 'revoked_invite_token';
  public constructor() {
    super('invitation revoked');
    this.name = 'RevokedInviteToken';
  }
}

/** Sign a reference id and return the URL-safe token. */
export const signInviteToken = (reference: string): string => {
  const signature = signReference(reference);
  return `${reference}.${signature}`;
};

const signReference = (reference: string): string => {
  const hmac = createHmac('sha256', getSecret()).update(reference).digest();
  return base64url(hmac);
};

/** Verify a token's HMAC. Constant-time comparison to avoid timing oracles. */
export const verifyInviteToken = (raw: string): ParsedToken => {
  const parsed = parseInviteToken(raw);
  const expected = signReference(parsed.reference);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(parsed.signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new InvalidInviteToken('signature mismatch');
  }
  return parsed;
};

const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
