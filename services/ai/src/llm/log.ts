/**
 * Observability for AI runs (TASK-H, PRD §10 "no cross-tenant data in observability").
 *
 * The event type only has room for ids, counts and fixed reason strings: prompts, answers and
 * model text cannot be logged through it. `reason` carries schema paths or a short fixed
 * phrase, never content.
 */
export interface AiLogEvent {
  readonly event: 'ai.call' | 'ai.invalid-output' | 'ai.failed-closed' | 'ai.done';
  readonly tenantId: string;
  /** The analysed submission (analysis runs), or absent for a report draft. */
  readonly submissionId?: string;
  /** The report being drafted (TASK-V report summary runs). */
  readonly reportId?: string;
  readonly route: string;
  readonly attempt?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly kept?: number;
  readonly dropped?: number;
  readonly reason?: string;
}

export type AiLogger = (e: AiLogEvent) => void;

export const noopLogger: AiLogger = () => undefined;

export const stderrLogger: AiLogger = (e) => {
  process.stderr.write(`${JSON.stringify(e)}\n`);
};
