import { describe, expect, it } from 'vitest';
import { parseRequest } from './privacyRequests';

const form = (o: Record<string, string>) => (k: string) => o[k] ?? null;

describe('parseRequest', () => {
  it('accepts an erase request with a code', () => {
    expect(
      parseRequest(form({ kind: 'erase', code: 'abc-12345678', engagementId: 'e' })),
    ).toMatchObject({
      kind: 'erase',
      code: 'abc-12345678',
    });
  });
  it('needs a code or a message for erase and withdraw, not for a question', () => {
    expect(parseRequest(form({ kind: 'erase' }))).toBeNull();
    expect(parseRequest(form({ kind: 'withdraw', message: 'please' }))).not.toBeNull();
    expect(parseRequest(form({ kind: 'question' }))).not.toBeNull();
  });
  it('refuses an unknown kind, a bad code, a bad reply address and a huge message', () => {
    expect(parseRequest(form({ kind: 'hack', code: 'x' }))).toBeNull();
    expect(parseRequest(form({ kind: 'erase', code: "x'; drop" }))).toBeNull();
    expect(parseRequest(form({ kind: 'erase', code: 'abc', replyTo: 'nope' }))).toBeNull();
    expect(parseRequest(form({ kind: 'question', message: 'x'.repeat(1001) }))).toBeNull();
  });
});
