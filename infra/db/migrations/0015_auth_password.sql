-- 0015_auth_password.sql
--
-- TASK-A (ADR 0023): minimal real auth. Adds an optional scrypt password hash to `users` so the
-- password provider can authenticate auditors. SSO / MFA (Gate C) will add further providers; a
-- NULL hash simply means "cannot sign in with a password".
--
-- The two seeded synthetic auditors get obviously-fake passwords (`synthetic-password-a` /
-- `synthetic-password-b`) for local dev, smoke and Playwright. Never reuse them anywhere real.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users SET password_hash = 'scrypt$16384$8$1$EE2HkJ5iyovtU16T/qQTJA==$REq3Dv6X1i7O5o7zTcJw7JsQT3xraXgoj034a7JdeEA='
 WHERE id = '99999999-9999-4999-8999-999999999999';
UPDATE users SET password_hash = 'scrypt$16384$8$1$mFGj0KboTyb0ZuJO4rGNxQ==$M1tu1/IGuAuuJAxSor9ldbTaDjLWsHlmVBbv30/0X4I='
 WHERE id = '99999999-9999-4999-8999-aaaaaaaaaaaa';

COMMIT;
