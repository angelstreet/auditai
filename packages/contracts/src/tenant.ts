import { z } from 'zod';
import { tenantIdSchema, isoDateTimeSchema } from './ids.js';

/**
 * Tenant \u2014 the platform boundary id. A tenant may host multiple organisations under the
 * deployment mode "shared multi-tenant hosting" (PRD \u00a724.1); in self-hosted mode a tenant
 * coincides with a single organisation. The data model treats tenant_id as the hard isolation
 * boundary; RLS policies rely on `current_setting('app.tenant_id')`.
 *
 * Public fields: the tenant slug is safe to show in URLs and audit logs. Internal-only fields
 * (DPA references, security contact) live behind a separate schema so the admin UI never
 * accidentally surfaces them in a list view.
 */

export const tenantPlanSchema = z.enum(['self_hosted', 'consultant_managed', 'shared_hosted']);
export type TenantPlan = z.infer<typeof tenantPlanSchema>;

export const tenantSchema = z.object({
  id: tenantIdSchema,
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'must be lowercase letters, digits and hyphens only'),
  displayName: z.string().min(1).max(120),
  plan: tenantPlanSchema,
  dataRegion: z.string().min(2).max(8),
  /** ISO timestamp of creation. */
  createdAt: isoDateTimeSchema,
  /** ISO timestamp of last modification; null when never modified after creation. */
  updatedAt: isoDateTimeSchema.nullable(),
  /**
   * `retentionDays` is the maximum age at which a tenant's submission rows may be deleted by the
   * retention job (PRD \u00a725.1 #9). Null means "no automatic deletion \u2014 manual approval required".
   */
  retentionDays: z.number().int().min(1).max(3650).nullable(),
});

export type Tenant = z.infer<typeof tenantSchema>;
