/** Password rule for self-service sign-in (TASK-U, ADR 0040): length only, no composition tricks. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

export type PasswordProblem = 'too_short' | 'too_long' | 'mismatch';

/** First problem with a new password, or null when it is acceptable. `again` is the typed copy. */
export const passwordProblem = (password: string, again?: string): PasswordProblem | null => {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (password.length > MAX_PASSWORD_LENGTH) return 'too_long';
  if (again !== undefined && again !== password) return 'mismatch';
  return null;
};
