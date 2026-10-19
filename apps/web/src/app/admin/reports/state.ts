/** Result of a report action: a code the page words (TASK-V). */
export interface ReportActionState {
  readonly ok: boolean;
  readonly code: string;
  readonly count?: number;
}

export const reportIdle: ReportActionState = { ok: false, code: 'idle' };
