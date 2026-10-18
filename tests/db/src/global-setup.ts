import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Vitest globalSetup \u2014 boots an embedded PostgreSQL for the duration of the test run *unless*
 * DATABASE_URL is already set (CI passes one pointing at a service container; this avoids
 * starting a second cluster on the same port).
 *
 * The package downloads a real PostgreSQL binary on first install (pnpm postinstall). The
 * returned teardown function is invoked by vitest once all tests have finished so the child
 * postgres process is not leaked between CI runs.
 */
export default async function setup(): Promise<() => Promise<void>> {
  if (process.env['DATABASE_URL']) {
    // eslint-disable-next-line no-console
    console.warn(`[tests/db] using external postgres at ${process.env['DATABASE_URL']}`);
    return async () => undefined;
  }

  const dataDir = mkdtempSync(join(tmpdir(), 'evolai-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'auditai',
    password: 'auditai',
    port: 54329,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('evolai_test');

  process.env['DATABASE_URL'] = `postgres://auditai:auditai@127.0.0.1:54329/evolai_test`;

  // eslint-disable-next-line no-console
  console.warn(`[tests/db] embedded postgres ready at ${process.env['DATABASE_URL']}`);

  return async () => {
    try {
      await pg.stop();
    } catch {
      // ignore \u2014 SIGINT during vitest teardown may race with this stop.
    }
  };
}
