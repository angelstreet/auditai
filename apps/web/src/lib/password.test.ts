import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password only', async () => {
    const h = await hashPassword('synthetic-password-x');
    expect(await verifyPassword('synthetic-password-x', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
  it('accepts the seeded synthetic hash format', async () => {
    const seeded =
      'scrypt$16384$8$1$EE2HkJ5iyovtU16T/qQTJA==$REq3Dv6X1i7O5o7zTcJw7JsQT3xraXgoj034a7JdeEA=';
    expect(await verifyPassword('synthetic-password-a', seeded)).toBe(true);
  });
});
