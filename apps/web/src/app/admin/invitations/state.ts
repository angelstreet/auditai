/** Result of an invitation action: a code the page maps to words, never an address or a message. */
export interface InviteActionState {
  readonly ok: boolean;
  readonly code: string;
  readonly count?: number;
  readonly emailSent?: number;
  readonly emailFailed?: number;
  readonly link?: string;
  /** The create form's values, sent back with a duplicate warning so the person does not retype them. */
  readonly echo?: Readonly<Record<string, string>>;
}

export const idleState: InviteActionState = { ok: false, code: 'idle' };
