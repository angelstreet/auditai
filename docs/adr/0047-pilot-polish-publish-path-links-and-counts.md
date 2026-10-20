# 0047 — Pilot polish: publish path, one count, links that copy

Status: accepted

## Context

Three acceptance tests of the pilot (auditor, referent, employee) found defects, not missing features:

- A report could not be published without an accepted improvement step, and with no approved opportunity there was no
  way to get one. The generated method note said "the auditor checked and approved each theme and opportunity" even
  when nothing was approved.
- The Engagements list, the Invitations page and the employee page counted invitations differently (revoked links in
  one, not in the other; "opened" as a current state in one and as "ever opened" in the other).
- Links were built with https for a local http copy, copied with the clipboard API only, and shown cut with an
  ellipsis. The expiry shown to an employee could differ from the date the link really stopped working.
- The privacy wording differed between the employee intro, the done page and the privacy page, and one of them said
  to withdraw through the manager.

## Decision

- **Publish path.** A report may be published when it has at least one approved finding or one accepted step
  (`buildSnapshot`; the code stays `nothing_accepted` and its message now says how to continue). "Write my own" works
  without an opportunity: `addStep(..., null, custom)` creates an approved opportunity titled like the step in the
  same transaction (audited as `opportunity.create`). No migration: `report_steps.opportunity_id` stays NOT NULL.
- **Honest text.** The method note comes from counts (`methodologyNote`: people answered, approved themes, approved
  opportunities; it says nothing is approved when nothing is). "Write a first draft" refreshes it with the summary.
  The editor warns under 5 respondents. The summary closing line does not point to a plan when there is no step.
- **One count.** `invitationNumbers(byStatus)` defines created, revoked, invited (created minus revoked), opened
  (opened, in progress or answered), started, completed, waiting, lapsed. The Engagements list uses it; the
  Invitations page and the employee team line use the same rules (revoked links never count as invited). The page
  shows "expected, created, cancelled, invited" in one sentence.
- **Links.** `resolveBaseUrl`: the site URL setting, else the request host; https for a public host whatever a header
  says, http only for a local or private-network host unless the proxy says https. One `copyText` with a textarea
  fallback, `navigator.share` when present, and on failure a dialog with the full text selected (`useLinkActions`).
  Full links are shown (wrapped) with copy and share, one by one and all together, for the referent and the auditor.
- **Employee deadline.** One function, `answerDeadline`, returns the earlier of the engagement closing date and the
  link's own expiry: the moment answering really stops. The done page shows that date.
- **Privacy.** One sentence (`survey.privacyShort`) on the intro, the done page and the privacy page, with one way to
  withdraw or delete: the existing privacy request form (`/privacy?e=…#request`), which does not go through the
  manager.
- Status words follow one pair per state in French and English (open/ouverte, closed/clôturée).

## Alternatives considered

- Make `report_steps.opportunity_id` nullable: needs a migration and every ranking and snapshot path to handle steps
  without an opportunity. The auto-created opportunity keeps one shape.
- Force the link expiry to the closing date at creation: does not fix links already created.

## Consequences

An auditor who writes a step by hand also gets an opportunity row in the register. Reports can be published with
findings only; the client report and PDF then have no steps section. Counting rules are in one tested function, so a
new screen must call it rather than write its own SQL.
