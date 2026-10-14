# ADR 0002 — Monorepo tooling, lint/test stack and leak scan

Status: proposed (2026-10-14). Created as part of M2 ([roadmap](../ROADMAP.md)).

## Context

PRD §12 / §13 recommend pnpm + Turborepo, TypeScript-strict, lint + format, Playwright for end-to-end tests,
and CI covering install, lint, typecheck and tests. The repository was empty of code so far. AGENTS.md requires a
"leak scan that fails on secrets, IPs, e-mail addresses and the words in AGENTS.md's public-repo rule".

## Decisions

- **Package manager:** pnpm 9.12.3, activated via corepack so the toolchain stays pinned to a Node release.
- **Build orchestration:** Turborepo 2.x with a single `build` / `lint` / `typecheck` / `test` / `clean` pipeline
  and workspace topology (`dependsOn: ["^build"]`). No remote cache in M2; we will revisit when CI volume rises.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`,
  `useUnknownInCatchVariables`. `exactOptionalPropertyTypes` stays off until a contributor needs it — false positives
  in JSON contract code outweigh the benefit in M2.
- **Linting:** ESLint 9 flat config + `typescript-eslint` recommended ruleset. Bans: `no-explicit-any`,
  `prefer-const`, `no-var`, `eqeqeq: smart`, `consistent-type-imports: prefer-type-imports`. We deliberately avoid
  Stylistic/Formatting rule sets because Prettier already handles formatting.
- **Formatting:** Prettier 3.3 with `singleQuote`, `trailingComma: all`, `printWidth: 100`, `endOfLine: lf`.
- **Unit testing:** Vitest 2.x, configured per package with `node` environment. Coverage (v8) is enabled via the
  Turbo `coverage/**` output; a later milestone will enforce a coverage floor per package.
- **End-to-end:** Playwright will be added in M5 (employee mobile survey) and M6 (admin page). M2 just leaves
  the directory and a placeholder.
- **Leak scan:** a 230-line Node script at `scripts/leak-scan.mjs`. It catches IPv4, IPv6 (skipping RFC 5737/3849
  documentation prefixes), e-mails, AWS/OpenAI/Anthropic/GitHub-PAT-style credentials, PEM private keys, and any
  string in `BANNED_TERMS` (provided as a GitHub Actions secret, never committed). Allowlist via
  `.leak-allowlist` (one substring per line; `#` is a comment).
- **CI:** two GitHub Actions workflows — `ci.yml` (install → format → lint → typecheck → test) and
  `leak-scan.yml` (the script above). `dependabot.yml` covers pnpm and GitHub Actions.

## Alternatives

- **npm workspaces instead of pnpm**: pnpm's content-addressed store is faster and avoids the
  hoisting footguns (phantom dependencies). Workspace file `pnpm-workspace.yaml` is one extra file.
- **Turborepo vs. nx**: nx is more powerful but heavier; Turborepo is enough for ~10 packages and is what the
  PRD example lists.
- **ESLint flat config vs. legacy `.eslintrc`**: ESLint 9.x is the current line; flat config is the future
  default. We adopt flat now to avoid a migration in M5.
- **Vitest vs. Jest**: Vitest is the de facto monorepo standard in 2026, plays nicely with `tsconfig.base.json`
  and Vite-style ESM, and is already recommended by Turborepo docs.
- **Gitleaks / trufflehog instead of the custom scan**: both are great, but the custom scan is auditable in
  one file and we want explicit category reporting in PR comments. We can adopt gitleaks later as a second
  layer.

## Consequences

- One more Node script to maintain (`scripts/leak-scan.mjs`). Future contributors should add rules there, not
  carve out allowlist entries, unless the match is genuinely a fixture.
- Banned client names must be added as `BANNED_TERMS` repo secret by a maintainer; we never commit them.
- Coverage floors and Playwright live in later milestones.
