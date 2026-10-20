# 0044 — The survey is submitted by an explicit finish, not by loading a page

Status: accepted

## Context

The done page submitted the survey while rendering. Next prefetches links in production, so opening the last question
could submit the survey before the person answered it, and the answer was then refused with 409 `already_submitted`
(and the screen blamed the network).

## Decision

- A GET never changes data. The done page is read-only: submitted shows the thank-you; an unfinished survey is sent
  back to its first open question, or shows "one more step" with a Finish button when every question is covered.
- `POST /api/submit` is the only submit path. Idempotent (a second call returns ok), keeps `purgeDelivery`, and refuses
  with 409 `incomplete` plus the first open question when a question is neither answered nor skipped.
- The last question finishes explicitly after its answer or skip is saved, then goes to done. Skip is now saved
  (`POST /api/skip`, answer kind `skipped`, never overwrites a real answer; scoring ignores it) so the server can check
  the rule. No migration: `value_json` is JSONB.
- Save errors: 409 says "You already finished this survey" and goes to done; only real failures blame the connection.

## Consequences

Prefetch can no longer submit. Old in-flight sessions that relied on the done page to submit must press Finish.
