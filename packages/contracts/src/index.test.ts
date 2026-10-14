import { describe, expect, it } from 'vitest';
import { contractPlaceholder } from './index.js';

describe('@auditai/contracts placeholder', () => {
  it('exports the M2 placeholder object', () => {
    expect(contractPlaceholder.note).toBe('replaced by Zod schemas in M3');
  });
});
