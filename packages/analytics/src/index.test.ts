import { describe, expect, it } from 'vitest';
import { analyticsPlaceholder } from './index.js';

describe('@evolai/analytics placeholder', () => {
  it('exports the M2 placeholder string', () => {
    expect(analyticsPlaceholder).toBe('replaced in Phase 2');
  });
});
