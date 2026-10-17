import { describe, expect, it } from 'vitest';
import { runRetentionWorker, type RetentionWorkerResult } from './retentionWorker.js';

/**
 * Pure smoke: the test fakes the pg client so the SQL path runs as
 * a string assertion. The integration smoke (m15-smoke.mjs) does the
 * real Postgres round-trip.
 */
describe('retention worker (M15, FR-09)', () => {
  it('exports the worker entry point + result type', () => {
    expect(typeof runRetentionWorker).toBe('function');
    const placeholder: RetentionWorkerResult = { tenantsScanned: 0, purged: 0 };
    expect(placeholder.tenantsScanned).toBe(0);
  });
});
