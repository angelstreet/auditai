/** Result of a set-up action: a code the page maps to words (TASK-T). */
export interface SetupActionState {
  readonly ok: boolean;
  readonly code: string;
}

export const setupIdle: SetupActionState = { ok: false, code: 'idle' };
