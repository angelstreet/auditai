export type FinishOutcome =
  | { kind: 'done' }
  | { kind: 'incomplete'; missingIndex: number }
  | { kind: 'failed' };

/** Explicit finish: the only client call that submits the survey. Safe to repeat. */
export const finishRequest = async (token: string): Promise<FinishOutcome> => {
  try {
    const r = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (r.ok) return { kind: 'done' };
    const body = (await r.json().catch(() => ({}))) as { error?: string; missingIndex?: number };
    if (r.status === 409 && body.error === 'incomplete' && typeof body.missingIndex === 'number') {
      return { kind: 'incomplete', missingIndex: body.missingIndex };
    }
  } catch {
    // network error: fall through
  }
  return { kind: 'failed' };
};
