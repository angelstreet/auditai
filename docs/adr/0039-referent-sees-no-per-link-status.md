# 0039 - The team referent never sees a per-link status

- Status: Accepted
- Date: 2026-10-19
- Related: [0033](0033-invitations-tracking-reminders.md), [0035](0035-view-as-and-client-referent-surface.md)

## Context

The five-persona test (docs/TEST_FEEDBACK_2026-10-19.md, item 3) found a privacy design flaw. The team referent
creates the survey links and hands each one to a named colleague, so the referent knows which link went to whom.
The team space showed a "reminder list" of links not yet answered (and the CSV export had a `kind=reminders`
variant, and the open-links list dropped a link once it was answered). With the link-to-person mapping in their
head, the referent could tell exactly who had answered and who had not. The minimum group rule (ADR 0033) only
checked how many people were invited, not how many answered, so "1 answered out of 6" was shown as is.

The same feedback asked for real self-service: a visible link list with copy and share, a ready-made message,
reminders that make sense, and progress that reads as "12 of 24 answered".

## Decision

1. **No per-link status in the team space.** The referent sees every link of their teams that still works (all
   states except revoked), in creation order, with no status, no expiry, no short code. The set and order are the
   same before and after anyone opens, starts or finishes the survey. The CSV export (`link,team`, any query string
   ignored) and the QR sheet use the same list (`listTeamLinks`). The auditor-only listings (`listOpen`,
   `reminderList`, `withAudit`, `progress`) lose their team filter and are never imported from referent code; a
   source guard test (`referentPrivacy.test.ts`) fails if one is.
2. **One generic reminder.** The reminder is a single message for the whole team ("if you have not answered yet
   ... if you have already answered, thank you"), with no link: people use the one they received. Copy, `mailto:`
   and `wa.me` only, with no address or number asked or stored. Suggested days: 7 and 2 days before the closing
   date (only days after the first link), or the engagement's schedule from the first link when there is no
   closing date. The Home call to action "Send the reminder" appears only on a suggested day or the day after,
   while the survey is open and the counts do not already show that everybody answered.
3. **Minimum group on answers too.** Per team: fewer than 5 invited shows only the invited total; 5 or more
   invited but fewer than 5 answered shows a coarse band ("no answers yet", "some", "most", most meaning at least
   half); from 5 answers the exact "N of M answered", the started count and a bar. The last activity day is never
   shown to the referent. Raw counts stay inside `referentProgress`, which returns only what
   `referentParticipation` allows.
4. **Per-link status stays with the auditor**, who never learns the mapping, and is still never joined to answers.
5. **Closing date and contact** are engagement settings on the auditor Invitations page: the closing date is the
   existing `engagements.closes_at` column, the contact is one line of free text in `privacy_json.contact`
   (the trail records only whether it is set). No migration. Without a configured contact the messages name the
   referent.

## Alternatives considered

- **Keep the reminder list but only above 5 invited.** Still exact per person: the mapping defeats any threshold.
- **Remind only people who have not answered, sent by the platform.** Needs addresses (email mode, ADR 0033) and
  would still tell the referent who was reminded if they see the count; the default mode stores no address.
- **Show exact counts from 5 invited (the old rule).** "1 of 6" plus timing lets the referent guess; the band
  costs little and keeps small numbers vague.
- **Hide the links once answered to avoid resending.** That is exactly the leak.

## Consequences

- A referent may resend a link to someone who already answered; the survey shows "already answered" for it, and
  the generic message thanks them. That is the price of anonymity.
- Live counts still move when someone answers. A referent who watches the page closely could correlate a change
  with a person; the band below 5 answers and the absence of activity days limit this. Exact counts above 5 are an
  accepted residual risk, stated in the referent's hint text.
- Revoke and regenerate are auditor actions on links not yet answered, so a link disappearing or changing in the
  referent's list says it was not answered at that moment. They happen only on request (a lost link) and are
  rare; accepted.
- The view-as banner (ADR 0035) collapses to one line on phones after its first page, with a details toggle; the
  `evolai_view_as_seen` cookie holds only the persona id and carries no authority.
