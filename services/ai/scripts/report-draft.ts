/**
 * Owner command: ask the approved AI route for a draft of one report's summary (TASK-V, ADR 0043).
 *
 *   DATABASE_URL=... EVOLAI_AI_PROVIDER=... pnpm --filter @evolai/ai report-draft -- \
 *     --tenant <tenant id> --engagement <engagement id> --actor <auditor user id>
 *
 * Prints counts and the route only, never the text (it is read in the report screen).
 */
import pg from 'pg';
import { ReportDraftError, runReportDraftJob } from '../src/reportDraftWorker.js';

const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !/^[0-9a-f-]{36}$/i.test(v)) {
    process.stderr.write(`missing or invalid --${name} <uuid>\n`);
    process.exit(2);
  }
  return v;
};

const url = process.env['DATABASE_URL'];
if (!url) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const draft = await runReportDraftJob({
    client,
    tenantId: arg('tenant'),
    engagementId: arg('engagement'),
    actorUserId: arg('actor'),
  });
  process.stdout.write(
    `${JSON.stringify({
      route: draft.route,
      promptVersion: draft.promptVersion,
      citations: draft.citations.length,
      dropped: draft.dropped,
      cost: `${draft.costAmount.toFixed(4)} ${draft.costCurrency}`,
    })}\n`,
  );
} catch (err) {
  if (err instanceof ReportDraftError) {
    process.stderr.write(`report draft refused: ${err.code}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`report draft failed: ${err instanceof Error ? err.name : 'error'}\n`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
