/**
 * Placeholder for `@auditai/contracts`. M3 fills in tenant, organisation, engagement, template, etc.
 * The placeholder keeps the package importable so the workspace, lint, typecheck and test pipelines
 * are exercised from day one. M3 deletes this export and adds the real schemas.
 */
export interface IdentifierPlaceholder {
  readonly note: 'replaced by Zod schemas in M3';
}

export const contractPlaceholder: IdentifierPlaceholder = {
  note: 'replaced by Zod schemas in M3',
};
