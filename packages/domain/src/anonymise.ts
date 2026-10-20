/**
 * Anonymise free text before it is stored (TASK-W, ADR 0044).
 *
 * Rule-based, deterministic, no network. E-mail addresses, phone numbers, links, social handles,
 * IBAN-like strings, long digit runs, employee or badge ids, postal addresses, the tenant's own
 * names-to-hide list and likely person names are replaced with readable placeholders. The
 * original text is never kept: callers store only `text`, and this module never logs or throws
 * with the input in a message.
 *
 * The heuristic is conservative on purpose: masking a few extra words is cheaper than leaking
 * a name. It is idempotent: anonymising already anonymised text changes nothing.
 */

export type AnonymiseLocale = 'fr' | 'en';

export interface AnonymiseOptions {
  readonly locale: AnonymiseLocale;
  /** The tenant's names-to-hide list (`ai_redaction_terms`). */
  readonly terms?: ReadonlyArray<string>;
}

export interface AnonymiseResult {
  readonly text: string;
  /** How many spans were replaced. A count only, never the values. */
  readonly masked: number;
}

/** Longest text processed. The question field is capped well below this. */
export const ANONYMISE_MAX_LENGTH = 4000;

const LABELS = {
  fr: {
    email: '[email]',
    phone: '[téléphone]',
    link: '[lien]',
    name: '[nom]',
    organisation: '[organisation]',
    number: '[numéro]',
    address: '[adresse]',
    handle: '[identifiant]',
  },
  en: {
    email: '[email]',
    phone: '[phone]',
    link: '[link]',
    name: '[name]',
    organisation: '[organisation]',
    number: '[number]',
    address: '[address]',
    handle: '[handle]',
  },
} as const;

/**
 * Capitalised words that are not people: months, days, tools, companies, common acronyms.
 * One editable list, compared case and accent insensitively. Add a word here when a tool name
 * is wrongly masked.
 */
export const NAME_STOP_LIST: ReadonlyArray<string> = [
  // months and days, fr and en
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  // tools and companies
  'chatgpt',
  'gpt',
  'openai',
  'claude',
  'anthropic',
  'gemini',
  'copilot',
  'mistral',
  'perplexity',
  'excel',
  'word',
  'powerpoint',
  'outlook',
  'teams',
  'sharepoint',
  'onedrive',
  'office',
  'microsoft',
  'google',
  'docs',
  'sheets',
  'drive',
  'gmail',
  'meet',
  'slack',
  'zoom',
  'notion',
  'jira',
  'confluence',
  'github',
  'gitlab',
  'sap',
  'salesforce',
  'oracle',
  'workday',
  'power',
  'bi',
  'python',
  'linkedin',
  'windows',
  'linux',
  'apple',
  'amazon',
  'aws',
  'azure',
  'whatsapp',
  'internet',
  'iso',
  'mr',
  'mrs',
  'ms',
  'dr',
  'mme',
  'mlle',
  'prof',
  'rgpd',
  'gdpr',
  // titles and words that start sentences or labels
  'monsieur',
  'madame',
  'mademoiselle',
  'docteur',
  'maître',
  'mister',
  'missus',
  'doctor',
  'professor',
  'professeur',
  'france',
  'europe',
  'français',
  'francais',
  'anglais',
  'english',
  'french',
];

/** Short words that begin a sentence and are not part of a person's name. */
const SENTENCE_STARTERS: ReadonlyArray<string> = [
  'the',
  'a',
  'an',
  'our',
  'this',
  'that',
  'these',
  'those',
  'my',
  'we',
  'i',
  'it',
  'they',
  'he',
  'she',
  'in',
  'on',
  'at',
  'for',
  'to',
  'if',
  'when',
  'as',
  'and',
  'but',
  'so',
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'mon',
  'ma',
  'mes',
  'notre',
  'nos',
  'ce',
  'cette',
  'ces',
  'je',
  'il',
  'elle',
  'on',
  'nous',
  'ils',
  'elles',
  'dans',
  'pour',
  'si',
  'quand',
  'et',
  'mais',
  'donc',
];

const PARTICLES = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'van',
  'von',
  'der',
  'den',
  'di',
  'da',
  'dos',
  'el',
  'al',
]);

/** Lower-case and strip accents, one UTF-16 unit in, one unit out, so indexes stay aligned. */
const foldChar = (c: string): string => {
  const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return f.length === c.length ? f : c;
};
const fold = (s: string): string => Array.from(s, foldChar).join('');
const foldWord = (s: string): string => fold(s).replace(/[’]/g, "'");

const STOP = new Set(NAME_STOP_LIST.map(foldWord));
const STARTERS = new Set(SENTENCE_STARTERS.map(foldWord));

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- patterns ---------------------------------------------------------------------------------

const EMAIL_RE = /[\p{L}\p{N}._%+'-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}/gu;

const URL_RE =
  /(?:\b(?:https?|ftp):\/\/|\bwww\.)[^\s<>"«»]+|(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}-]+\.)+(?:com|org|net|fr|io|eu|be|ch|de|uk|co|ai|app|dev|info|biz|gouv\.fr)(?:\/[^\s<>"«»]*)?(?![\p{L}\p{N}-])/giu;

const HANDLE_RE = /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_][\p{L}\p{N}_.]{1,30}/gu;

const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g;

/** A run of digits that may be split by spaces, dots, dashes or brackets: phone numbers, ids. */
const DIGITS_RE = /(?<![\p{L}\p{N}])[+(]?\d[\d ()./-]{6,}\d(?![\p{N}])/gu;

const KEYED_ID_RE =
  /\b(matricule|badge|employee(?: id| number| no)?|staff(?: id| number)?|emp|identifiant|id|n°|numéro|number)(?![\p{L}\p{N}])(\s*(?:n°|no\.?|#|:)\s*|\s+)([A-Z]{0,4}[-_]?\d{3,}[A-Z0-9_-]*)/giu;

const BADGE_LIKE_RE = /(?<![\p{L}\p{N}])(?!ISO)[A-Z]{1,5}[-_]?\d{4,}[A-Z0-9_-]*(?![\p{L}\p{N}])/gu;

const STREET_TYPES =
  'rue|avenue|av\\.?|boulevard|bd|chemin|impasse|allée|allee|place|route|quai|cours|passage|square|street|st\\.?|road|rd\\.?|lane|drive|way';
const ADDRESS_FR_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+(?:${STREET_TYPES})(?![\\p{L}])\\s*(?:(?:de|du|des|la|le|les|l'|d'|of|the)\\s*)*\\p{Lu}[\\p{L}'’-]*(?:\\s+(?:(?:de|du|des|la|le|les|of|the)\\s+)*\\p{Lu}[\\p{L}'’-]*){0,3}(?:,?\\s*\\d{5}(?:\\s+\\p{Lu}[\\p{L}'’-]+){0,2})?`,
  'giu',
);
const ADDRESS_EN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])\\d{1,4}[A-Za-z]?,?\\s+(?:\\p{Lu}[\\p{L}'’-]+\\s+){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Drive|Way|Square|Boulevard)\\b\\.?(?:,?\\s*[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}\\b)?`,
  'gu',
);
const POSTCODE_CITY_RE = /(?<![\p{L}\p{N}])\d{5}\s+\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)?/gu;

const TITLE_RE =
  /(?<![\p{L}\p{N}])(M\.|Mme\.?|Mlle\.?|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Pr\.?|Prof\.?|Monsieur|Madame|Mademoiselle|Docteur|Doctor|Professeur|Professor|Maître|Mister)(\s+)((?:[\p{L}][\p{L}'’-]*(?:[ \t]+|(?![\p{L}]))){1,4})/giu;

const TOKEN_RE = /[\p{L}][\p{L}'’-]*/gu;
const TITLE_CASE_RE = /^\p{Lu}\p{Ll}[\p{L}'’-]*$/u;
const ALL_CAPS_RE = /^\p{Lu}{3,}$/u;

// --- helpers ----------------------------------------------------------------------------------

const digitCount = (s: string): number => (s.match(/\d/g) ?? []).length;

const looksLikeDate = (s: string): boolean =>
  /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(s) || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(s);

const isCapName = (w: string): boolean => TITLE_CASE_RE.test(w) || ALL_CAPS_RE.test(w);

const isStop = (w: string): boolean => STOP.has(foldWord(w));

const atSentenceStart = (text: string, index: number): boolean => {
  let i = index - 1;
  while (i >= 0 && /[\s"'«“‘([\-•*>]/u.test(text.charAt(i))) {
    if (text.charAt(i) === '\n') return true;
    i -= 1;
  }
  if (i < 0) return true;
  return /[.!?…]/.test(text.charAt(i));
};

class Masker {
  masked = 0;
  private readonly termIndex = new Map<string, number>();
  constructor(
    private readonly labels: (typeof LABELS)[AnonymiseLocale],
    private readonly terms: ReadonlyArray<string>,
  ) {}

  private hit<T extends string>(replacement: T): T {
    this.masked += 1;
    return replacement;
  }

  replace(
    text: string,
    re: RegExp,
    label: string | ((m: string) => string),
    keep?: (m: string) => boolean,
  ): string {
    return text.replace(re, (m) =>
      keep?.(m) ? m : this.hit(typeof label === 'string' ? label : label(m)),
    );
  }

  /** The tenant's names, accent and case insensitive, whole words, one placeholder per term. */
  hideTerms(text: string): string {
    const cleaned = Array.from(
      new Set(this.terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
    )
      .map((t) => ({ raw: t, folded: foldWord(t.normalize('NFC')) }))
      .sort((a, b) => b.folded.length - a.folded.length);
    if (cleaned.length === 0) return text;
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${cleaned.map((c) => escapeRe(c.folded)).join('|')})(?![\\p{L}\\p{N}])`,
      'gu',
    );
    const folded = foldWord(text);
    let out = '';
    let last = 0;
    for (const m of folded.matchAll(re)) {
      const start = m.index ?? 0;
      let n = this.termIndex.get(m[0]);
      if (n === undefined) {
        n = this.termIndex.size + 1;
        this.termIndex.set(m[0], n);
      }
      const base = this.labels.organisation;
      out += text.slice(last, start) + this.hit(n === 1 ? base : `${base.slice(0, -1)} ${n}]`);
      last = start + m[0].length;
    }
    return out + text.slice(last);
  }

  keyedIds(text: string): string {
    return text.replace(KEYED_ID_RE, (_m, key: string, sep: string) =>
      this.hit(`${key}${sep}${this.labels.number}`),
    );
  }

  titledNames(text: string): string {
    return text.replace(TITLE_RE, (whole, title: string, space: string, rest: string) => {
      const abbreviated = /^(M\.|Mme|Mlle|Mr|Mrs|Ms|Dr|Pr|Prof)\.?$/i.test(title);
      const tokens = Array.from(rest.matchAll(TOKEN_RE));
      let taken = 0;
      for (let i = 0; i < tokens.length; i += 1) {
        const w = tokens[i]?.[0] as string;
        const f = foldWord(w);
        const particle = PARTICLES.has(f) && i + 1 < tokens.length;
        const ok =
          !isStop(w) &&
          !(STARTERS.has(f) && !particle) &&
          (isCapName(w) ||
            particle ||
            (abbreviated && i === 0 && w.length >= 3 && !PARTICLES.has(f)));
        if (!ok) break;
        taken = i + 1;
      }
      // A trailing particle is not part of the name.
      while (taken > 0 && PARTICLES.has(foldWord(tokens[taken - 1]?.[0] as string))) taken -= 1;
      if (taken === 0) return whole;
      const last = tokens[taken - 1] as RegExpMatchArray;
      const end = (last.index ?? 0) + last[0].length;
      return `${title}${space}${this.hit(this.labels.name)}${rest.slice(end)}`;
    });
  }

  /** Runs of two or more capitalised words (first name + last name), outside the stop list. */
  namePairs(text: string): string {
    const re = /[\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*)*/gu;
    return text.replace(re, (run: string, offset: number) => {
      const tokens = run.match(TOKEN_RE) ?? [];
      const seps = run.split(TOKEN_RE);
      // Mark the tokens that can belong to a name.
      const kind = tokens.map((w, i) => {
        if (isStop(w)) return 'x';
        if (isCapName(w)) return 'n';
        if (PARTICLES.has(foldWord(w)) && i > 0 && i + 1 < tokens.length) return 'p';
        return 'x';
      });
      const startsSentence = atSentenceStart(text, offset);
      const out: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        const prefix = i === 0 ? '' : (seps[i] ?? ' ');
        if (kind[i] !== 'n') {
          out.push(prefix + tokens[i]);
          i += 1;
          continue;
        }
        let j = i;
        while (j + 1 < tokens.length && (kind[j + 1] === 'n' || kind[j + 1] === 'p')) j += 1;
        while (j > i && kind[j] === 'p') j -= 1;
        const count = j - i + 1;
        const first = tokens[i] as string;
        const sentenceStart = i === 0 && startsSentence;
        const mask = count >= 2 && !(sentenceStart && STARTERS.has(foldWord(first)) && count < 3);
        if (mask) {
          out.push(prefix + this.hit(this.labels.name));
          i = j + 1;
        } else {
          for (let k = i; k <= j; k += 1) out.push((k === 0 ? '' : (seps[k] ?? ' ')) + tokens[k]);
          i = j + 1;
        }
      }
      return (seps[0] ?? '') + out.join('');
    });
  }
}

/** Replace personal data in `input` with readable placeholders. Pure and deterministic. */
export const anonymise = (input: string, options: AnonymiseOptions): AnonymiseResult => {
  const labels = LABELS[options.locale];
  const m = new Masker(labels, options.terms ?? []);
  let t = input.normalize('NFC').slice(0, ANONYMISE_MAX_LENGTH);

  t = m.hideTerms(t);
  t = m.replace(t, EMAIL_RE, labels.email);
  t = m.replace(t, URL_RE, labels.link);
  t = m.replace(t, HANDLE_RE, labels.handle);
  t = m.replace(t, ADDRESS_FR_RE, labels.address);
  t = m.replace(t, ADDRESS_EN_RE, labels.address);
  t = m.replace(t, POSTCODE_CITY_RE, labels.address);
  t = m.replace(t, IBAN_RE, labels.number);
  t = m.keyedIds(t);
  t = m.replace(
    t,
    DIGITS_RE,
    (s) => (/^\d+$/.test(s) && !/^0\d{9}$/.test(s) ? labels.number : labels.phone),
    (s) => digitCount(s) < 8 || looksLikeDate(s.trim()),
  );
  t = m.replace(t, /\d{9,}/g, labels.number);
  t = m.replace(t, BADGE_LIKE_RE, labels.number);
  t = m.titledNames(t);
  t = m.namePairs(t);

  return { text: t, masked: m.masked };
};
