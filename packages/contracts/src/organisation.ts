import { z } from 'zod';
import {
  departmentIdSchema,
  isoDateTimeSchema,
  organisationIdSchema,
  tenantIdSchema,
} from './ids.js';

/**
 * Organisation \u2014 the legal entity (or entity-equivalent) the engagement is delivered to. Per PRD
 * \u00a714, organisation, departments and teams all sit *inside* the tenant. We therefore validate
 * the tenant_id cross-field: an organisation's tenant id must equal the tenant id stored on its
 * owning tenant record (checked at the service layer; the schema just requires both to exist).
 */

export const organisationSchema = z.object({
  id: organisationIdSchema,
  tenantId: tenantIdSchema,
  legalName: z.string().min(1).max(200),
  tradingName: z.string().min(1).max(200).nullable(),
  /** Country code, ISO 3166-1 alpha-2. Determines which legal template the privacy notice uses. */
  country: z.string().regex(/^[A-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 country code'),
  /** Sector helps the AI worker pick the right calibration items (PRD \u00a76.1). Optional. */
  sector: z.string().min(1).max(80).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Organisation = z.infer<typeof organisationSchema>;

/**
 * Department is a coarse grouping (legal/operational sub-unit). Teams belong to a department; an
 * organisation with no formal department hierarchy uses a single synthetic department per the
 * service-level loader.
 */
export const departmentSchema = z.object({
  id: departmentIdSchema,
  tenantId: tenantIdSchema,
  organisationId: organisationIdSchema,
  name: z.string().min(1).max(120),
  /** Stable code the consultant can use in URLs; unique within an organisation. */
  code: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Department = z.infer<typeof departmentSchema>;
