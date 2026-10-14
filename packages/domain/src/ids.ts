import {
  type TenantId,
  tenantIdSchema,
  organisationIdSchema,
  departmentIdSchema,
  teamIdSchema,
  userIdSchema,
  engagementIdSchema,
  templateIdSchema,
  questionnaireVersionIdSchema,
  questionItemIdSchema,
  invitationIdSchema,
  submissionIdSchema,
  answerIdSchema,
  type OrganisationId,
  type DepartmentId,
  type TeamId,
  type UserId,
  type EngagementId,
  type TemplateId,
  type QuestionnaireVersionId,
  type QuestionItemId,
  type InvitationId,
  type SubmissionId,
  type AnswerId,
} from '@auditai/contracts';

/**
 * Domain-side helpers for working with branded IDs.
 *
 * - `parse*` are thin wrappers over the Zod schemas that throw a `DomainError` instead of a Zod
 *   error. The application boundary catches `DomainError` and turns it into a 400/422.
 * - `unsafe*` accept a string and trust the caller. Use only inside trusted code paths (e.g.
 *   migration scripts) where the input has already been validated.
 */

export class DomainError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

const parseBranded =
  <Brand extends string>(
    schema: {
      safeParse: (v: string) => {
        success: boolean;
        data?: unknown;
        error?: { issues: Array<{ message: string }> };
      };
    },
    code: string,
    _brand: Brand,
  ) =>
  (value: string): Brand => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError(
        code,
        `invalid ${code}: ${parsed.error?.issues[0]?.message ?? 'unknown'}`,
      );
    }
    return parsed.data as Brand;
  };

export const parseTenantId: (v: string) => TenantId = parseBranded(
  tenantIdSchema,
  'tenant_id',
  'TenantId' as never,
);
export const parseOrganisationId: (v: string) => OrganisationId = parseBranded(
  organisationIdSchema,
  'organisation_id',
  'OrganisationId' as never,
);
export const parseDepartmentId: (v: string) => DepartmentId = parseBranded(
  departmentIdSchema,
  'department_id',
  'DepartmentId' as never,
);
export const parseTeamId: (v: string) => TeamId = parseBranded(
  teamIdSchema,
  'team_id',
  'TeamId' as never,
);
export const parseUserId: (v: string) => UserId = parseBranded(
  userIdSchema,
  'user_id',
  'UserId' as never,
);
export const parseEngagementId: (v: string) => EngagementId = parseBranded(
  engagementIdSchema,
  'engagement_id',
  'EngagementId' as never,
);
export const parseTemplateId: (v: string) => TemplateId = parseBranded(
  templateIdSchema,
  'template_id',
  'TemplateId' as never,
);
export const parseQuestionnaireVersionId: (v: string) => QuestionnaireVersionId = parseBranded(
  questionnaireVersionIdSchema,
  'questionnaire_version_id',
  'QuestionnaireVersionId' as never,
);
export const parseQuestionItemId: (v: string) => QuestionItemId = parseBranded(
  questionItemIdSchema,
  'question_item_id',
  'QuestionItemId' as never,
);
export const parseInvitationId: (v: string) => InvitationId = parseBranded(
  invitationIdSchema,
  'invitation_id',
  'InvitationId' as never,
);
export const parseSubmissionId: (v: string) => SubmissionId = parseBranded(
  submissionIdSchema,
  'submission_id',
  'SubmissionId' as never,
);
export const parseAnswerId: (v: string) => AnswerId = parseBranded(
  answerIdSchema,
  'answer_id',
  'AnswerId' as never,
);

/**
 * Re-exports so callers can import branded types from `@auditai/domain` without reaching into
 * `@auditai/contracts` for type-level details.
 */
export type {
  TenantId,
  OrganisationId,
  DepartmentId,
  TeamId,
  UserId,
  EngagementId,
  TemplateId,
  QuestionnaireVersionId,
  QuestionItemId,
  InvitationId,
  SubmissionId,
  AnswerId,
};

/**
 * `requireSameTenant` is the runtime guard every cross-tenant write/read goes through.
 * It is intentionally tiny so it can be invoked at every repository call site.
 */
export const requireSameTenant = (
  recordTenant: TenantId,
  expectedTenant: TenantId,
  resource: string,
): void => {
  if (recordTenant !== expectedTenant) {
    throw new DomainError(
      'tenant_mismatch',
      `${resource} belongs to a different tenant (expected ${expectedTenant}, got ${recordTenant})`,
    );
  }
};
