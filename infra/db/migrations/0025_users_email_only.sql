-- 0025_users_email_only.sql
--
-- TASK-X (ADR 0044): accounts are identified by an e-mail address only. No first name, surname or
-- display name is asked, stored or shown.
--   * users.display_name becomes nullable and unused (not dropped yet: forward-only, dropped later).
--   * users.email holds the sign-in address in clear so the app can label an account by its address
--     (header, view-as, audit trail). It is filled when an account is created, when its address is
--     replaced and at sign-in; email_hash stays the lookup key. Employees have no users row.
-- Idempotent, forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

COMMIT;
