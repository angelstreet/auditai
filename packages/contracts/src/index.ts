/**
 * Public surface of `@auditai/contracts`. Every entity is exported as both its Zod schema and
 * the inferred TypeScript type. Other packages import from here so they share the same validation
 * logic as the API layer.
 */

export * from './ids.js';
export * from './roles.js';
export * from './tenant.js';
export * from './organisation.js';
export * from './team.js';
export * from './engagement.js';
export * from './template.js';
export * from './invitation.js';
export * from './submission.js';
export * from './auditLog.js';
export * from './opportunity.js';
export * from './sponsorBrief.js';
export * from './synergy.js';
export * from './respondentBadge.js';
