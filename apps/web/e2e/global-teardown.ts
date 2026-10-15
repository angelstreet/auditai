import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Playwright global teardown. Reads the state file written by `global-setup.ts`
 * and stops the embedded Postgres if we started it.
 */
export default async function globalTeardown(): Promise<void> {
  const stateFile = join(process.cwd(), '.playwright-database-url');
  if (!existsSync(stateFile)) return;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    if (state?.port && state?.dataDir) {
      // We started an embedded Postgres on a free port. Kill any process bound to it.
      const { execSync } = await import('node:child_process');
      try {
        execSync(`pkill -f "auditai-pw-pg-${state.dataDir.split('/').pop()}" || true`, {
          stdio: 'ignore',
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore parse errors
  }
  try {
    unlinkSync(stateFile);
  } catch {
    // ignore
  }
}
