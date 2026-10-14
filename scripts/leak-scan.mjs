#!/usr/bin/env node
/**
 * Leak scan — fails the build if a tracked file looks like a credential, IP address, e-mail
 * address, or contains one of the banned terms configured by the repository owner.
 *
 * Why a custom script?
 *   • Gitleaks / trufflehog are good but heavyweight for a first iteration.
 *   • We want a single small, auditable script that the team can read and adjust.
 *
 * Categories checked:
 *   1. Banned terms — secret names supplied via env `BANNED_TERMS` (comma-separated, lower-case).
 *   2. IP addresses (IPv4 and IPv6).
 *   3. E-mail addresses.
 *   4. Generic high-entropy credentials (AWS, OpenAI/Anthropic style keys, PEM blocks, JWTs).
 *
 * Allowlist:
 *   `.leak-allowlist` is a newline-separated list of patterns (one per line). A line matches when
 *   the offending line (trimmed) contains the pattern as a substring. `#` starts a comment.
 *   Documentation IPs in the RFC 5737 / RFC 3849 ranges are ignored by default.
 *
 * Exit codes:
 *   0 = clean
 *   1 = one or more findings
 *   2 = misconfiguration
 */

import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
  '.vercel',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
  '.sql',
  '.sh',
  '.bash',
  '.txt',
  '.html',
  '.css',
  '.gql',
  '.graphql',
  '.py',
  '.go',
  '.rs',
  '.rb',
]);

const MAX_FILE_BYTES = 1_000_000; // 1MB — refuse to scan huge files

// RFC 5737 / 3849 documentation ranges (used in examples and fixtures).
const DOC_IPV4_PREFIXES = ['192.0.2.', '198.51.100.', '203.0.113.'];
const DOC_IPV6_PREFIXES = ['2001:db8:', '3fff:0:0:'];

const RULES = [
  {
    id: 'email',
    // Simple email regex; intentionally narrow to avoid false positives in markdown.
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    id: 'ipv4',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    allowWhen: (line) => DOC_IPV4_PREFIXES.some((p) => line.includes(p)),
  },
  {
    id: 'ipv6',
    // Match at least two colon-separated hextets and require a digit — avoids catching `:1` ports.
    regex: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g,
    allowWhen: (line) => DOC_IPV6_PREFIXES.some((p) => line.includes(p)),
  },
  {
    id: 'aws-access-key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: 'openai-style-key',
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: 'anthropic-style-key',
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: 'github-pat',
    regex: /\bghp_[A-Za-z0-9]{30,}\b/g,
  },
  {
    id: 'private-key-pem',
    regex: /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/g,
  },
  {
    id: 'jwt',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

/** @type {Set<string>} */
const bannedTerms = new Set(
  (process.env.BANNED_TERMS ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2),
);

/** @returns {Promise<{ allowlist: Array<{pattern: string, line: number, raw: string}> }>} */
async function loadAllowlist() {
  try {
    const raw = readFileSync(join(ROOT, '.leak-allowlist'), 'utf8');
    const lines = raw.split(/\r?\n/);
    const entries = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      entries.push({ pattern: trimmed, line: i + 1, raw: line });
    });
    return { allowlist: entries };
  } catch {
    return { allowlist: [] };
  }
}

/** @param {string} dir */
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * @param {string} relPath
 * @returns {boolean}
 */
function shouldScan(relPath) {
  if (relPath.includes(`${sep}.git${sep}`)) return false;
  const lastDot = relPath.lastIndexOf('.');
  const ext = lastDot >= 0 ? relPath.slice(lastDot) : '';
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * @param {string} line
 * @param {Array<{pattern: string}>} allowlist
 * @returns {boolean}
 */
function lineAllowed(line, allowlist) {
  for (const { pattern } of allowlist) {
    if (line.includes(pattern)) return true;
  }
  return false;
}

/**
 * @param {string} content
 * @param {string} file
 * @param {Array<{pattern: string}>} allowlist
 * @returns {Array<{file: string, line: number, rule: string, snippet: string}>}
 */
function scanContent(content, file, allowlist) {
  /** @type {Array<{file: string, line: number, rule: string, snippet: string}>} */
  const findings = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    for (const term of bannedTerms) {
      if (lower.includes(term)) {
        if (!lineAllowed(line, allowlist)) {
          findings.push({ file, line: idx + 1, rule: `banned-term:${term}`, snippet: line.trim() });
        }
      }
    }
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(line)) !== null) {
        if (rule.allowWhen && rule.allowWhen(line)) continue;
        if (lineAllowed(line, allowlist)) continue;
        findings.push({
          file,
          line: idx + 1,
          rule: rule.id,
          snippet: line.trim().slice(0, 240),
        });
      }
    }
  });
  return findings;
}

async function main() {
  const { allowlist } = await loadAllowlist();
  const findings = [];
  for await (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (!shouldScan(rel)) continue;
    let stat;
    try {
      stat = statSync(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;
    const content = readFileSync(file, 'utf8');
    findings.push(...scanContent(content, rel, allowlist));
  }

  if (findings.length === 0) {
    process.stdout.write(
      `leak-scan: clean (${bannedTerms.size} banned term(s), ${allowlist.length} allowlist entries)\n`,
    );
    process.exit(0);
  }

  process.stderr.write(`leak-scan: ${findings.length} finding(s)\n`);
  for (const f of findings) {
    process.stderr.write(`  ${f.file}:${f.line}  [${f.rule}]  ${f.snippet}\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`leak-scan: error ${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(2);
});
