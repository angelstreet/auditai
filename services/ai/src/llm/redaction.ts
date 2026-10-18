/**
 * Redaction before any model call (TASK-H, PRD §10 and §25.1).
 *
 * Emails, phone numbers, IBAN-like strings, long digit identifiers and the names on the
 * tenant's own list are replaced with stable placeholders (`[EMAIL_1]`, `[NAME_2]`, ...). The
 * mapping lives only in memory for one analysis of one tenant; `restore` refuses any other
 * tenant. Placeholder-shaped text typed by a respondent is neutralised first, so it can never
 * be restored into somebody else's value.
 */

export type PlaceholderKind = 'EMAIL' | 'PHONE' | 'IBAN' | 'ID' | 'NAME';

const PLACEHOLDER_RE = /\[(EMAIL|PHONE|IBAN|ID|NAME)_(\d+)\]/g;

const PATTERNS: ReadonlyArray<{ kind: PlaceholderKind; re: RegExp }> = [
  { kind: 'EMAIL', re: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu },
  { kind: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g },
  // Phone: optional +country, then at least 8 digits split by spaces, dots, dashes or brackets.
  { kind: 'PHONE', re: /(?:\+\d{1,3}[ .-]?)?(?:\(?\d{1,4}\)?[ .-]){2,}\d{2,4}\b/g },
  // Any remaining run of 9 or more digits (employee numbers, national ids, card numbers).
  { kind: 'ID', re: /\b\d{9,}\b/g },
];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const digitCount = (s: string): number => (s.match(/\d/g) ?? []).length;

export class Redactor {
  private readonly toPlaceholder = new Map<string, string>();
  private readonly toValue = new Map<string, string>();
  private readonly counters: Record<PlaceholderKind, number> = {
    EMAIL: 0,
    PHONE: 0,
    IBAN: 0,
    ID: 0,
    NAME: 0,
  };
  private readonly nameRe: RegExp | null;

  constructor(
    readonly tenantId: string,
    names: ReadonlyArray<string> = [],
  ) {
    const cleaned = names
      .map((n) => n.trim())
      .filter((n) => n.length >= 2)
      .sort((a, b) => b.length - a.length)
      .map(escapeRe);
    this.nameRe =
      cleaned.length > 0
        ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${cleaned.join('|')})(?![\\p{L}\\p{N}])`, 'giu')
        : null;
  }

  /** Number of distinct values replaced so far. */
  get replacedCount(): number {
    return this.toValue.size;
  }

  private placeholderFor(kind: PlaceholderKind, value: string): string {
    const key = `${kind}:${kind === 'NAME' || kind === 'EMAIL' ? value.toLowerCase() : value}`;
    const existing = this.toPlaceholder.get(key);
    if (existing) return existing;
    this.counters[kind] += 1;
    const ph = `[${kind}_${this.counters[kind]}]`;
    this.toPlaceholder.set(key, ph);
    this.toValue.set(ph, value);
    return ph;
  }

  redact(text: string): string {
    let out = text.replace(PLACEHOLDER_RE, '(placeholder removed)');
    for (const { kind, re } of PATTERNS) {
      out = out.replace(re, (m) => {
        if (kind === 'PHONE' && digitCount(m) < 8) return m;
        return this.placeholderFor(kind, m);
      });
    }
    if (this.nameRe) {
      out = out.replace(this.nameRe, (m) => this.placeholderFor('NAME', m));
    }
    return out;
  }

  /** Put original values back. Only the tenant that owns the mapping may do this. */
  restore(text: string, tenantId: string): string {
    if (tenantId !== this.tenantId) {
      throw new Error('redaction mapping belongs to another tenant');
    }
    return text.replace(PLACEHOLDER_RE, (ph) => this.toValue.get(ph) ?? ph);
  }
}
