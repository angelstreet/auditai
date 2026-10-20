# 0044 - Anonymise free text before it is stored

- Status: Accepted
- Date: 2026-10-20
- Related: [0029](0029-llm-synthesis-provider-abstraction.md), [0040](0040-referent-login-privacy-notice-audit-trail.md), TASK-W

## Context

Redaction (ADR 0029) only protected the copy sent to a model. Any free text stored in the database kept what the
person typed: names, emails, phone numbers. For the pilot (an MVP) the owner decided the data question is settled
if the stored answer is anonymous, so the original must never be stored.

At the time of this change the employee survey collects one tap per question and no free-text field. The stored
shapes that can hold respondent text are `answers.value_json` (`short_text.text`, `scenario_choice.rationale`),
`answers.rationale` and `submissions.end_comment`. The answer route accepts an optional `comment`.

## Decision

- **One function.** `anonymise(text, { locale, terms })` in `@evolai/domain` is rule-based, deterministic, with
  no network, in French and English. It masks emails, phone numbers (international and French), links, `@handles`,
  IBAN-like strings, runs of nine or more digits, keyed employee or badge ids, postal addresses, the tenant's
  names-to-hide list (`ai_redaction_terms`, case and accent insensitive, whole words, `[organisation]`,
  `[organisation 2]` ... per distinct term within one answer), names after a title (M., Mme, Mr, Dr, Monsieur,
  Madame ...) and runs of two or more capitalised words. Placeholders are readable and follow the engagement
  language (`[email]`, `[téléphone]` / `[phone]`, `[lien]` / `[link]`, `[nom]` / `[name]`, `[organisation]`).
  It is idempotent and returns a count of masked spans, never the values.
- **Conservative on purpose.** A few extra words masked is cheaper than a leaked name. A capitalised pair at a
  sentence start is masked too unless it begins with a plain sentence starter (The, Le, ...). A single first
  name with no title is not detected: that is what the names-to-hide list is for. Tool and company names, months
  and days are kept through one editable list (`NAME_STOP_LIST`).
- **On ingestion.** `POST /api/answer` anonymises the optional `comment` with the tenant's terms and the
  submission language before writing, and stores only the result in `scenario_choice.rationale`. The original is
  not logged, not in an error, not in the audit log and has no "raw" column. An over-long comment is refused with
  a generic error that does not echo it.
- **Backfill.** `pnpm anonymise:backfill` runs the same function over stored free text (all four places above),
  tenant by tenant. Dry run by default, `--apply` to write, counts per tenant only, idempotent, one audit row per
  tenant (`answers.anonymise`, target kind `tenant`; migration 0025, forward only).
- **AI step.** It reads the stored, already anonymised text. The model redaction pass of ADR 0029 stays as a
  second line.
- **Employee hint.** The wording "Do not write names, emails or phone numbers. We hide them automatically." is
  to be shown beside a free-text field. No survey page has one yet, so no hint is shown and nothing scary
  appears. The privacy notice and the entry page state the anonymisation.

## Alternatives

- Anonymise in the database (trigger): hides logic from review and from the unit corpus.
- Call a model or an NER service: network, cost and a new processor; not deterministic.
- Keep the original encrypted: contradicts "never stored".
- Add a free-text field to every question now: changes the one-tap flow (PRD §5); not needed for the pilot.

## Consequences

- Anonymisation is heuristic, not proof: rare names and unusual formats can survive. The notice says "hidden
  automatically", not "guaranteed". Add client names to the names-to-hide list before a pilot (RUNBOOK).
- The original text is unrecoverable by design; a wrong mask cannot be undone.
- The corpus in `packages/domain/src/anonymise.test.ts` (95+ cases, French and English) is the contract: add a
  case with every fix.
