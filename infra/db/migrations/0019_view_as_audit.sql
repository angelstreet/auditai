-- 0019_view_as_audit.sql
--
-- TASK-P (ADR 0035): "view as" for the platform owner. No new table and no new column: the
-- view-as state lives only in the signed session cookie. This migration only widens the audit
-- trail so every view-as step is recorded with the real actor:
--
--   * view_as.start    the owner started viewing a tenant as a client persona
--   * view_as.stop     the owner went back to their own view
--   * view_as.request  one page or route served while viewing as (payload: path, role)
--   * view_as.refused  a mutating action refused because the view-as session is read-only
--   * client.seed      the first-client seed CLI created rows (names in flags, never in the repo)
--   * user.set_email   the CLI replaced a user's sign-in e-mail (e.g. a placeholder referent)
--
-- The target is the persona user ('user'). Forward-only, safe to apply on a live database.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve', 'analysis.reject',
      'opportunity.create', 'opportunity.update', 'opportunity.archive',
      'synergy.detect', 'synergy.surface', 'synergy.dismiss', 'synergy.archive',
      'export.complete', 'badge.erase', 'pseudonym.erase',
      'user.create', 'user.set_password', 'user.disable',
      'invitation.create_batch', 'invitation.export', 'invitation.revoke',
      'invitation.extend', 'invitation.regenerate', 'invitation.remind',
      'invitation.purge_addresses', 'invitation.settings',
      'view_as.start', 'view_as.stop', 'view_as.request', 'view_as.refused',
      'client.seed', 'user.set_email'
    ));

COMMIT;
