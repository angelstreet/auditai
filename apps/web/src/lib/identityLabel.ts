/**
 * Accounts are identified by an e-mail address only (ADR 0044): no first name, surname or display
 * name is stored or shown. Every place that labels a user goes through these helpers, which accept
 * null and empty values.
 */

const LABEL_MAX = 24;

/** The part of the address before "@", cut to a short label. Empty when there is no address. */
export const emailLabel = (email: string | null | undefined, max: number = LABEL_MAX): string => {
  const local = (email ?? '').trim().split('@')[0] ?? '';
  return local.length > max ? `${local.slice(0, max - 1)}…` : local;
};

/** Label for a user, falling back to a role label (or a dash) when no address is known. */
export const userLabel = (email: string | null | undefined, fallback = '—'): string =>
  emailLabel(email) || fallback;

/** One or two capitals from the local part of an address ("ana.demo@x" gives "AD"); "?" if none. */
export const initialsOf = (label: string): string => {
  const local = (label ?? '').trim().split('@')[0] ?? '';
  const parts = local.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${[...(parts[0] ?? '')][0] ?? ''}${[...(parts[1] ?? '')][0] ?? ''}`
      : [...(parts[0] ?? '')].slice(0, 2).join('');
  return letters.toUpperCase() || '?';
};
