#!/usr/bin/env node
/**
 * Auditor account CLI (TASK-K, ADR 0032).
 *
 *   pnpm auditor:create       --email a@b.c --name "Full Name" --tenant <uuid> [--tenant <uuid>]
 *   pnpm auditor:set-password --email a@b.c
 *   pnpm auditor:disable      --email a@b.c
 *
 * The password is read from a hidden prompt (TTY) or from stdin (one line), never from argv, and
 * is never logged. Connection string: DATABASE_URL_UNPOOLED, else DATABASE_URL. Optional
 * --expect-host <host> refuses to run against any other database host.
 */
import { createInterface } from 'node:readline';
import pg from 'pg';
import {
  createAuditor,
  disableAuditor,
  resolveTargetUrl,
  setAuditorPassword,
} from './auditor-lib.mjs';

const parseArgs = (argv) => {
  const out = { tenant: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    i += 1;
    if (key === 'tenant') out.tenant.push(value);
    else out[key] = value;
  }
  return out;
};

const readSecret = (prompt) =>
  new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin });
      rl.once('line', (line) => {
        rl.close();
        resolve(line);
      });
      rl.once('close', () => resolve(''));
      return;
    }
    process.stderr.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let buf = '';
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stderr.write('\n');
          return resolve(buf);
        }
        if (c === '\u0003') return reject(new Error('cancelled'));
        if (c === '\u007f') buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    process.stdin.on('data', onData);
  });

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!['create', 'set-password', 'disable'].includes(command ?? '')) {
    throw new Error('usage: auditor.mjs create|set-password|disable --email ...');
  }
  const url = resolveTargetUrl(process.env, args['expect-host']);
  let password;
  if (command !== 'disable') {
    password = await readSecret('New password (min 12 characters): ');
    if (process.stdin.isTTY) {
      const again = await readSecret('Repeat password: ');
      if (again !== password) throw new Error('passwords do not match');
    }
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (command === 'create') {
      const r = await createAuditor(client, {
        email: args.email,
        displayName: args.name,
        tenantIds: args.tenant,
        password,
      });
      process.stdout.write(`created auditor ${r.id}\n`);
    } else if (command === 'set-password') {
      const r = await setAuditorPassword(client, { email: args.email, password });
      process.stdout.write(`password updated for ${r.id}\n`);
    } else {
      const r = await disableAuditor(client, { email: args.email });
      process.stdout.write(`disabled ${r.id}\n`);
    }
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  process.stderr.write(`auditor: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
