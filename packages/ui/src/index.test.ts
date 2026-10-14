import { describe, expect, it } from 'vitest';
import { uiPlaceholder } from './index.js';

describe('@auditai/ui placeholder', () => {
  it('exports the M2 placeholder string', () => {
    expect(uiPlaceholder).toBe('replaced in M5');
  });
});
