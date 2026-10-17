import { describe, expect, it } from 'vitest';
import { pickDominant } from './teamBadgeRollup.js';

/**
 * The pickDominant helper is pure; test it explicitly so the tie-break
 * (fox > owl > tortoise) is locked in.
 */
describe('team badge rollup (M14 slice C, FR-08)', () => {
  it('picks fox when fox wins outright', () => {
    expect(pickDominant({ tortoise_count: 2, fox_count: 4, owl_count: 1 })).toBe('fox');
  });

  it('picks owl when owl wins outright', () => {
    expect(pickDominant({ tortoise_count: 1, fox_count: 2, owl_count: 5 })).toBe('owl');
  });

  it('picks tortoise when tortoise wins outright', () => {
    expect(pickDominant({ tortoise_count: 6, fox_count: 1, owl_count: 1 })).toBe('tortoise');
  });

  it('breaks a fox/owl tie in favour of fox', () => {
    expect(pickDominant({ tortoise_count: 0, fox_count: 3, owl_count: 3 })).toBe('fox');
  });

  it('breaks an owl/tortoise tie in favour of owl', () => {
    expect(pickDominant({ tortoise_count: 2, fox_count: 0, owl_count: 2 })).toBe('owl');
  });

  it('picks tortoise when nothing has voted (empty team)', () => {
    expect(pickDominant({ tortoise_count: 0, fox_count: 0, owl_count: 0 })).toBe('tortoise');
  });
});
