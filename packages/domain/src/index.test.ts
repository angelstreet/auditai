import { describe, expect, it } from 'vitest';
import { domainPlaceholder } from './index.js';

describe('@auditai/domain placeholder', () => {
  it('exports the M2 placeholder string', () => {
    expect(domainPlaceholder).toBe('replaced in M3');
  });
});
