# Contracts map (`@auditai/contracts`)

> Top-level index for the public surface of `@auditai/contracts`.
> Every other package (`@auditai/domain`, `@auditai/ai`, `@auditai/web`)
> imports from here so the same validation logic lives in one place.

## How the public surface is composed

- Every entity is exported as **both a Zod schema** (`*Schema`) and an
  inferred TypeScript type (`Type` / `Xxx`).
- Every write request has a `*WriteSchema` (no id / createdAt / updatedAt).
- Discriminated variants (`*AuditLogSchema`, `OpportunityStatusTransition`)
  refine the base shape with a literal discriminator.
- ID primitives are **branded UUIDs** so a `TenantId` can't be assigned to
  a `SubmissionId` even though both are plain strings at runtime.

## Layout

```
contracts/src/
├── ids.ts              ← identifier primitives + branded factories + Locale
├── roles.ts           ← Role + Capability enums
├── tenant.ts          ← Tenant + RetentionPolicy
├── organisation.ts   ← Organisation + Department
├── team.ts            ← Team
├── engagement.ts      ← Engagement + EngagementPrivacy + EngagementStatus
├── template.ts        ← Template + QuestionnaireVersion + QuestionItem + Sensitivity + CompetencyAxis
├── invitation.ts      ← Invitation + InvitationStatus + InvitationTokenShape + Respondent
├── submission.ts      ← Submission + SubmissionStatus + AnswerValue
├── auditLog.ts        ← AuditLog + AuditAction + AuditTargetKind + discriminated variants
├── opportunity.ts     ← Opportunity + OpportunityStatus + ImpactScore + status transitions + OPPORTUNITY_STATUS_LABELS
├── sponsorBrief.ts    ← SponsorBrief + sponsor enums + MaturityScore (M12)
├── synergy.ts         ← Synergy + SynergyStatus + SynergyId + SynergyKey + status transitions (M13)
├── respondentBadge.ts ← MascotTier + QuizScore + RespondentBadge + TeamBadge + score → tier mapping (M14)
└── index.ts           ← the public barrel re-export of the above
```

## Per-file exports (consumed by other packages + server actions)

### `ids.ts` — identifier primitives

| Export                                | Type               | Purpose                                                                                                                                                                                   |
| ------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ulidRegex`                           | regex              | ULID format check.                                                                                                                                                                        |
| `localeSchema`                        | Zod enum           | `'fr' \| 'en'`.                                                                                                                                                                           |
| `Locale`                              | TS type            | Inferred from `localeSchema`.                                                                                                                                                             |
| `isoDateTimeSchema`                   | Zod string         | ISO-8601 with timezone offset.                                                                                                                                                            |
| `uuidV4Schema`                        | Zod string         | UUID v4 only.                                                                                                                                                                             |
| `brandedId(brand)`                    | factory            | Branded UUID factory.                                                                                                                                                                     |
| `isUuidV4(v)`                         | helper             | Test-only UUID v4 check.                                                                                                                                                                  |
| `tenantIdSchema` … `auditLogIdSchema` | Zod branded string | 14 branded IDs (Tenant, Organisation, Department, Team, User, Engagement, Template, QuestionnaireVersion, QuestionItem, Invitation, Submission, Answer, Analysis, Opportunity, AuditLog). |
| `respondentPseudonymSchema`           | Zod string         | Lowercase letters / digits / hyphens, 8-64 chars (per-platform pseudonym, no FK to a real person).                                                                                        |
| `paginationCursorSchema`              | Zod string         | Opaque base64url cursor.                                                                                                                                                                  |

### `roles.ts` — RBAC

| Export             | Type     | Purpose                                                                              |
| ------------------ | -------- | ------------------------------------------------------------------------------------ |
| `roleSchema`       | Zod enum | Auditor / sponsor / respondent / observer enum.                                      |
| `Role`             | TS type  | Inferred.                                                                            |
| `capabilitySchema` | Zod enum | Read-only list of capabilities surfaces that may or may not be granted for a tenant. |
| `Capability`       | TS type  | Inferred.                                                                            |

### `tenant.ts`

| Export         | Type       | Purpose                                                                                        |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `tenantSchema` | Zod object | The tenant wire shape (`id`, `slug`, `display_name`, `plan`, `data_region`, `retention_days`). |
| `Tenant`       | TS type    | Inferred.                                                                                      |

### `organisation.ts`

| Export               | Type       | Purpose                                                     |
| -------------------- | ---------- | ----------------------------------------------------------- |
| `organisationSchema` | Zod object | Org wire shape (legal_name, trading_name, country, sector). |
| `Organisation`       | TS type    | Inferred.                                                   |
| `departmentSchema`   | Zod object | Department wire shape (name, code).                         |
| `Department`         | TS type    | Inferred.                                                   |

### `team.ts`

| Export       | Type       | Purpose                                               |
| ------------ | ---------- | ----------------------------------------------------- |
| `teamSchema` | Zod object | Team wire shape + `expected_headcount` + description. |
| `Team`       | TS type    | Inferred.                                             |

### `engagement.ts`

| Export                    | Type       | Purpose                                                                       |
| ------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `engagementStatusSchema`  | Zod enum   | `draft \| scheduled \| in_field \| analysis \| review \| closed \| archived`. |
| `EngagementStatus`        | TS type    | Inferred.                                                                     |
| `engagementPrivacySchema` | Zod object | Per-engagement privacy settings (the `privacy_json` payload).                 |
| `EngagementPrivacy`       | TS type    | Inferred.                                                                     |
| `engagementSchema`        | Zod object | Engagement wire shape.                                                        |
| `Engagement`              | TS type    | Inferred.                                                                     |

### `template.ts`

| Export                       | Type       | Purpose                                                                                          |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `sensitivitySchema`          | Zod enum   | `public \| internal \| sensitive` — maps to `M9` redaction.                                      |
| `Sensitivity`                | TS type    | Inferred.                                                                                        |
| `questionKindSchema`         | Zod enum   | `scenario_choice`, `free_text` (free_text redacted at export).                                   |
| `QuestionKind`               | TS type    | Inferred.                                                                                        |
| `competencyAxisSchema`       | Zod enum   | `literacy \| practice \| organisational_readiness`.                                              |
| `CompetencyAxis`             | TS type    | Inferred.                                                                                        |
| `templateSchema`             | Zod object | The template (named, tenant-scoped editor object).                                               |
| `Template`                   | TS type    | Inferred.                                                                                        |
| `questionnaireVersionSchema` | Zod object | Immutable version of a template at a point in time.                                              |
| `QuestionnaireVersion`       | TS type    | Inferred.                                                                                        |
| `questionItemSchema`         | Zod object | One question item (axis, code, kind, locale, prompt, options, scoring, sensitivity, retestable). |
| `QuestionItem`               | TS type    | Inferred.                                                                                        |

### `invitation.ts`

| Export                       | Type       | Purpose                                                                                                                                               |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invitationStatusSchema`     | Zod enum   | `pending \| opened \| in_progress \| submitted \| revoked \| expired`.                                                                                |
| `InvitationStatus`           | TS type    | Inferred.                                                                                                                                             |
| `invitationTokenShapeSchema` | Zod object | Token envelope (`tokenReference`, `signature`, `expiresAt`).                                                                                          |
| `InvitationTokenShape`       | TS type    | Inferred.                                                                                                                                             |
| `invitationSchema`           | Zod object | Wire shape (engagement_id, team_id, respondent_pseudonym, status, opens_at, expires_at, open_count, submission_id, token_reference, token_signature). |
| `Invitation`                 | TS type    | Inferred.                                                                                                                                             |
| `respondentSchema`           | Zod object | Platform-issued respondent identity (tenant_id, pseudonym, team_id).                                                                                  |
| `Respondent`                 | TS type    | Inferred.                                                                                                                                             |

### `submission.ts`

| Export                   | Type       | Purpose                                                                          |
| ------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `submissionStatusSchema` | Zod enum   | `in_progress \| submitted \| abandoned \| expired`.                              |
| `SubmissionStatus`       | TS type    | Inferred.                                                                        |
| `submissionSchema`       | Zod object | The submission (engagement_id, invitation_id, locale, started_at, submitted_at). |
| `Submission`             | TS type    | Inferred.                                                                        |
| `answerValueSchema`      | Zod union  | Tagged answer values (`scenario_choice`, `multi_choice`, `free_text`).           |
| `AnswerValue`            | TS type    | Inferred.                                                                        |

> **Privacy boundary:** `AnswerValueSchema` accepts `free_text` but the
> server-side filter (PRD §15) MUST redact it from any export pipeline
> before the analyst ever sees it.

### `auditLog.ts` — PRD §25.4

| Export                      | Type          | Purpose                                                                                                                                                                              |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auditActionSchema`         | Zod enum      | `analysis.approve \| analysis.reject \| opportunity.create \| opportunity.update \| opportunity.archive \| synergy.detect \| synergy.surface \| synergy.dismiss \| synergy.archive`. |
| `AuditAction`               | TS type       | Inferred.                                                                                                                                                                            |
| `auditTargetKindSchema`     | Zod enum      | `analysis \| opportunity \| synergy`.                                                                                                                                                |
| `AuditTargetKind`           | TS type       | Inferred.                                                                                                                                                                            |
| `auditLogSchema`            | Zod object    | Wire shape (tenant_id, actor_user_id, action, target_kind, target_id, payload).                                                                                                      |
| `AuditLog`                  | TS type       | Inferred.                                                                                                                                                                            |
| `analysisAuditLogSchema`    | discriminated | Refines `target_kind = 'analysis'` + `target_id` as `AnalysisId`.                                                                                                                    |
| `AnalysisAuditLog`          | TS type       | Inferred.                                                                                                                                                                            |
| `opportunityAuditLogSchema` | discriminated | Refines `target_kind = 'opportunity'` + `target_id` as `OpportunityId`.                                                                                                              |
| `OpportunityAuditLog`       | TS type       | Inferred.                                                                                                                                                                            |
| `synergyAuditLogSchema`     | discriminated | Refines `target_kind = 'synergy'` + `target_id` as `SynergyId`.                                                                                                                      |
| `SynergyAuditLog`           | TS type       | Inferred.                                                                                                                                                                            |
| `auditLogWriteSchema`       | Zod object    | Write shape (no id, no createdAt).                                                                                                                                                   |
| `AuditLogWrite`             | TS type       | Inferred.                                                                                                                                                                            |
| `approvalResultSchema`      | Zod object    | The approve / reject action result (M10).                                                                                                                                            |
| `ApprovalResult`            | TS type       | Inferred.                                                                                                                                                                            |

### `opportunity.ts` — PRD §11, FR-08, FR-12

| Export                              | Type       | Purpose                                                                                                             |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `opportunityStatusSchema`           | Zod enum   | `draft \| approved \| in_progress \| delivered \| archived`.                                                        |
| `OpportunityStatus`                 | TS type    | Inferred.                                                                                                           |
| `impactScoreSchema`                 | Zod number | 0..1 score in 0.001 steps.                                                                                          |
| `ImpactScore`                       | TS type    | Inferred.                                                                                                           |
| `opportunitySchema`                 | Zod object | Wire shape (engagement_id, analysis_id, status, title, description, axis, impact_score, owner_user_id, created_by). |
| `Opportunity`                       | TS type    | Inferred.                                                                                                           |
| `opportunityWriteSchema`            | Zod object | Write shape (no id, no timestamps).                                                                                 |
| `OpportunityWrite`                  | TS type    | Inferred.                                                                                                           |
| `opportunityStatusTransitionSchema` | Zod refine | Refines allowed status graph moves.                                                                                 |
| `OpportunityStatusTransition`       | TS type    | Inferred.                                                                                                           |
| `nextOpportunityStatuses(from)`     | helper     | Allowed next statuses from a given state.                                                                           |
| `OPPORTUNITY_STATUS_LABELS`         | const map  | Display labels per status (FR `OPPORTUNITY_STATUS_LABELS`).                                                         |

### `sponsorBrief.ts` — M12, FR-08

| Export                               | Type       | Purpose                                                                                                                                    |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `sponsorDepartmentSchema`            | Zod enum   | 6 departments (operations, sales, finance, legal, engineering, people).                                                                    |
| `SponsorDepartment`                  | TS type    | Inferred.                                                                                                                                  |
| `sponsorSensitivitySchema`           | Zod enum   | 4 sensitivity tiers (internal_only / public_web / customer_pii / regulated).                                                               |
| `SponsorSensitivity`                 | TS type    | Inferred.                                                                                                                                  |
| `sponsorOnsiteAppetiteSchema`        | Zod enum   | `full_pilot \| limited_team \| remote_only`.                                                                                               |
| `SponsorOnsiteAppetite`              | TS type    | Inferred.                                                                                                                                  |
| `sponsorModelRegionSchema`           | Zod enum   | 4 model region constraints (eu_only, us_enterprise, self_hosted, no_constraint).                                                           |
| `SponsorModelRegion`                 | TS type    | Inferred.                                                                                                                                  |
| `sponsorResidencySchema`             | Zod enum   | 3 residency tiers (eu_frankfurt, us, client_vpc).                                                                                          |
| `SponsorResidency`                   | TS type    | Inferred.                                                                                                                                  |
| `sponsorPromptInjectionReviewSchema` | Zod enum   | 3 review options (external_auditor, internal, none_yet).                                                                                   |
| `SponsorPromptInjectionReview`       | TS type    | Inferred.                                                                                                                                  |
| `maturityScoreSchema`                | Zod number | 0..5 self-assessment (integer).                                                                                                            |
| `MaturityScore`                      | TS type    | Inferred.                                                                                                                                  |
| `sponsorBriefSchema`                 | Zod object | Wire shape (top priority, departments, sensitivity, budget, appetite, model regions, residency, prompt-injection review, 3 maturity axes). |
| `SponsorBrief`                       | TS type    | Inferred.                                                                                                                                  |
| `sponsorBriefWriteSchema`            | Zod object | Write shape (tenant, sponsor user, optional engagement id, defaults).                                                                      |
| `SponsorBriefWrite`                  | TS type    | Inferred.                                                                                                                                  |

### `synergy.ts` — M13, FR-14

| Export                          | Type         | Purpose                                                                                                                         |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `synergyStatusSchema`           | Zod enum     | `detected \| surfaced \| dismissed \| archived`.                                                                                |
| `SynergyStatus`                 | TS type      | Inferred.                                                                                                                       |
| `synergyKeySchema`              | Zod string   | Stable lowercase hash of `(axis \| lower(themeLabel))`.                                                                         |
| `SynergyKey`                    | TS type      | Inferred.                                                                                                                       |
| `synergyIdSchema`               | branded UUID | The synergy row id (worker-generated).                                                                                          |
| `SynergyId`                     | TS type      | Inferred.                                                                                                                       |
| `synergySchema`                 | Zod object   | Wire shape (axis, theme_label, source_analysis_ids, source_engagement_ids, occurrence_count, proposed_followup_prompt, status). |
| `Synergy`                       | TS type      | Inferred.                                                                                                                       |
| `synergyWriteSchema`            | Zod object   | Write shape (worker input).                                                                                                     |
| `SynergyWrite`                  | TS type      | Inferred.                                                                                                                       |
| `SYNERGY_STATUS_TRANSITIONS`    | const map    | Allowed status graph moves (detected → surfaced/dismissed → archived).                                                          |
| `synergyStatusTransitionSchema` | Zod refine   | Refines the move (from → to).                                                                                                   |
| `SynergyStatusTransition`       | TS type      | Inferred.                                                                                                                       |

### `respondentBadge.ts` — M14, PRD §6, §9, §15

| Export                       | Type        | Purpose                                                                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `mascotTierSchema`           | Zod enum    | `tortoise \| fox \| owl`.                                                                                     |
| `MascotTier`                 | TS type     | Inferred.                                                                                                     |
| `mascotTierOrder`            | const array | Canonical ordering (`['tortoise','fox','owl']`).                                                              |
| `quizScoreSchema`            | Zod number  | 1..100 (integer).                                                                                             |
| `QuizScore`                  | TS type     | Inferred.                                                                                                     |
| `quizAnswerSchema`           | Zod object  | One `{questionCode, value}` pair (no free-text).                                                              |
| `QuizAnswer`                 | TS type     | Inferred.                                                                                                     |
| `mascotTierForScore(s)`      | helper      | Maps a `QuizScore` to a `MascotTier`. ≤50 tortoise, 51–80 fox, ≥81 owl.                                       |
| `tierDescriptorFromType(t)`  | helper      | One-line EN description per tier (mirrors `@auditai/domain.tierDescriptor`).                                  |
| `respondentBadgeSchema`      | Zod object  | Wire shape (tenant, pseudonym, engagement_id, quiz_score, mascot_tier, source_answers, is_current).           |
| `RespondentBadge`            | TS type     | Inferred.                                                                                                     |
| `respondentBadgeWriteSchema` | Zod object  | Write shape (no id / timestamps).                                                                             |
| `RespondentBadgeWrite`       | TS type     | Inferred.                                                                                                     |
| `teamBadgeSchema`            | Zod object  | Wire shape (tenant, team_id, dominant_tier, member_count, tortoise_count, fox_count, owl_count, computed_at). |
| `TeamBadge`                  | TS type     | Inferred.                                                                                                     |

## Cross-cutting guarantees

- **Privacy-by-construction.** Every respondent-facing wire shape carries
  only the mascot tier + descriptor; raw `quiz_score` lives only on the
  server and is read by the analyst via the Postgres layer.
- **No export pipeline keeps free-text.** `AnswerValueSchema.accepts(free_text)`
  but PRD §15 forbids the analyst from ever seeing it. Free-text is
  captured by the schema so the validator accepts the form payload but
  the export workers MUST strip it.
- **Discriminated unions for audit logs.** `analysisAuditLogSchema` etc.
  refine the polymorphic `targetId` on `targetKind` so consumers never
  have to runtime-check both.
- **Status transitions are schemas, not enums.** `opportunityStatusTransitionSchema`
  and `synergyStatusTransitionSchema` carry the graph; the data layer
  runs the parse so the server-side reject is enforced uniformly.
- **Branded UUIDs.** A `TenantId` cannot be assigned to a `UserId` even
  though both are strings at runtime; the `brandedId(brand)` factory
  keeps the casts auditable.

## Tests + coverage

Every contract carries a sibling `*.test.ts` in `packages/contracts/src/`.
The current count after M14 is **110 contracts tests**; `pnpm test`
runs them all.
