/** Result shape of the team space actions; split out so client components can import it. */
export interface ClientActionState {
  readonly ok: boolean;
  /** idle | created | read_only | forbidden | bad_count | no_survey | failed */
  readonly code: string;
  readonly count?: number;
}

export const clientIdle: ClientActionState = { ok: false, code: 'idle' };
