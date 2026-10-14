# ADR 0001 — License and initial stack

Status: proposed (2026-10-14), revisit before v1 (PRD §34 question 1).

## Context
PRD §24 recommends a public repository under a permissive license (Apache-2.0) or AGPL-3.0 if network copyleft is
wanted. PRD §12–§13 recommend a TypeScript monorepo with Next.js, PostgreSQL with row-level security, typed AI workers.

## Decision
- License: **Apache-2.0** for code, as the PRD's default recommendation. Assessment item banks: licensing to decide
  separately. Branding/trademark is outside the code license.
- Stack: pnpm + Turborepo monorepo; Next.js + TypeScript + Tailwind for `apps/web`; PostgreSQL + migrations + RLS;
  AI workers in TypeScript or Python behind a provider abstraction; Playwright for end-to-end tests.

## Alternatives
AGPL-3.0 (stronger reciprocity for hosted forks, but may deter enterprise self-hosting); a separate NestJS API from day
one (deferred until complexity requires it).

## Consequences
Anyone may self-host and modify; commercial value sits in services (PRD §24). Revisit if hosted forks become a concern.
