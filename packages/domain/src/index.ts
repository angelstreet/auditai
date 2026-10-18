/**
 * Public surface of `@evolai/domain`. Wraps the Zod schemas from `@evolai/contracts` with
 * domain-side helpers: branded-ID parsing, tenant guards, role/capability matrix, deterministic
 * scoring, and template versioning.
 */

export * from './ids.js';
export * from './permissions.js';
export * from './scoring.js';
export * from './template-versioning.js';
export * from './literacyQuiz.js';
