import { describe, expect, it } from 'vitest';
import { anonymise, type AnonymiseLocale } from './anonymise.js';

type Case = readonly [label: string, input: string, expected: string, locale?: AnonymiseLocale];

const run = (input: string, locale: AnonymiseLocale = 'en', terms: string[] = []): string =>
  anonymise(input, { locale, terms }).text;

const CASES: ReadonlyArray<Case> = [
  // e-mail
  ['email plain', 'Write to jane.doe@example.com today', 'Write to [email] today'],
  ['email plus tag', 'jane+work@sub.example.org is mine', '[email] is mine'],
  ['email fr', 'Écrivez à marie.durand@exemple.fr svp', 'Écrivez à [email] svp', 'fr'],
  ['email accent local part', 'élodie@exemple.fr', '[email]', 'fr'],
  ['email in brackets', 'Contact (a.b@ex.com).', 'Contact ([email]).'],
  // phone
  ['phone french spaces', 'Appelez le 06 12 34 56 78 demain', 'Appelez le [téléphone] demain', 'fr'],
  ['phone french dots', 'Mon numéro : 01.23.45.67.89', 'Mon numéro : [téléphone]', 'fr'],
  ['phone french dashes', 'tel 01-23-45-67-89', 'tel [téléphone]', 'fr'],
  ['phone compact', 'tel 0612345678', 'tel [téléphone]', 'fr'],
  ['phone intl plus', 'Call +33 6 12 34 56 78 now', 'Call [phone] now'],
  ['phone intl uk', 'Call +44 20 7946 0958 now', 'Call [phone] now'],
  ['phone intl brackets', 'Call +33 (0)6 12 34 56 78', 'Call [phone]'],
  ['phone us', 'Call 555-123-4567 please', 'Call [phone] please'],
  ['phone us brackets', 'Call (555) 123-4567 please', 'Call [phone] please'],
  // links, handles
  ['url https', 'See https://intranet.example.com/page?id=4 for details', 'See [link] for details'],
  ['url www', 'Go to www.example.com now', 'Go to [link] now'],
  ['url bare domain', 'Visit example.fr today', 'Visit [lien] today', 'fr'],
  ['url fr label', 'Voir https://exemple.fr/x', 'Voir [lien]', 'fr'],
  ['handle', 'Ping @jdoe_42 on chat', 'Ping [handle] on chat'],
  ['handle fr', 'Écris à @marie.d', 'Écris à [identifiant]', 'fr'],
  // numbers
  ['iban', 'IBAN FR76 3000 6000 0112 3456 7890 189 ok', 'IBAN [number] ok'],
  ['long digits', 'Card 4111111111111111 stored', 'Card [number] stored'],
  ['employee keyed', 'Employee ID: 4821937 is mine', 'Employee ID: [number] is mine'],
  ['matricule', 'Mon matricule A12345 est noté', 'Mon matricule [numéro] est noté', 'fr'],
  ['badge keyed', 'badge n° 889123', 'badge n° [number]'],
  ['badge like', 'My id is EMP-48213 ok', 'My id is [number] ok'],
  // addresses
  ['address fr', 'J’habite 12 rue de la Paix, 75002 Paris', 'J’habite [adresse]', 'fr'],
  ['address fr avenue', 'Bureau au 5 avenue Victor Hugo', 'Bureau au [adresse]', 'fr'],
  ['address fr bis', '14 bis boulevard Saint-Michel 75005 Paris', '[adresse]', 'fr'],
  ['address en', 'I live at 221B Baker Street', 'I live at [address]'],
  ['address en road', 'Office: 10 Downing Road', 'Office: [address]'],
  ['postcode city', 'Site de 69003 Lyon', 'Site de [adresse]', 'fr'],
  // titles
  ['title M.', 'J’en ai parlé à M. Dupont hier', 'J’en ai parlé à M. [nom] hier', 'fr'],
  ['title Mme', 'Mme Martin est d’accord', 'Mme [nom] est d’accord', 'fr'],
  ['title Mr', 'Mr Smith said no', 'Mr [name] said no'],
  ['title Mrs dot', 'Mrs. Johnson agreed', 'Mrs. [name] agreed'],
  ['title Dr', 'Dr House knows', 'Dr [name] knows'],
  ['title Monsieur', 'Monsieur Jean-Pierre Durand est venu', 'Monsieur [nom] est venu', 'fr'],
  ['title Madame particle', 'Madame de la Fontaine a écrit', 'Madame [nom] a écrit', 'fr'],
  ['title lowercase abbr', 'dis à mme leblanc', 'dis à mme [nom]', 'fr'],
  ['title two names', 'Mr John Smith joined', 'Mr [name] joined'],
  // name pairs
  ['pair mid sentence', 'I asked Jean Dupont about it', 'I asked [name] about it'],
  ['pair hyphen', 'Nous avons vu Jean-Pierre Martin', 'Nous avons vu [nom]', 'fr'],
  ['pair caps surname', 'Please contact Marie DUPONT for it', 'Please contact [name] for it'],
  ['pair sentence start', 'Jean Dupont m’a dit non.', '[nom] m’a dit non.', 'fr'],
  ['pair after period', 'Ok. Sarah Connor called.', 'Ok. [name] called.'],
  ['pair with particle', 'Please ask Pierre de Villiers today', 'Please ask [name] today'],
  ['pair van', 'with Anna van Berg again', 'with [name] again'],
  ['two pairs', 'Jean Dupont and Marie Curie met', '[name] and [name] met'],
  // organisation terms
  [
    'term company',
    'Nous utilisons Acme Demo pour cela',
    'Nous utilisons [organisation] pour cela',
    'fr',
  ],
];

const FALSE_POSITIVES: ReadonlyArray<Case> = [
  ['Excel alone', 'I use Excel every day', 'I use Excel every day'],
  ['Teams alone', 'We meet on Teams', 'We meet on Teams'],
  ['Microsoft Teams', 'We meet on Microsoft Teams daily', 'We meet on Microsoft Teams daily'],
  ['Microsoft Copilot', 'I tried Microsoft Copilot', 'I tried Microsoft Copilot'],
  ['Google Drive', 'Files live in Google Drive', 'Files live in Google Drive'],
  ['ChatGPT', 'I ask ChatGPT for a draft', 'I ask ChatGPT for a draft'],
  ['ChatGPT Outlook', 'ChatGPT and Outlook help me', 'ChatGPT and Outlook help me'],
  ['SAP', 'The SAP module is slow', 'The SAP module is slow'],
  ['Monsieur alone', 'Monsieur, merci', 'Monsieur, merci', 'fr'],
  ['Madame alone', 'Bonjour Madame', 'Bonjour Madame', 'fr'],
  ['Mr alone', 'Dear Mr', 'Dear Mr'],
  ['month', 'It ended in January', 'It ended in January'],
  ['month fr', 'Réunion en Janvier', 'Réunion en Janvier', 'fr'],
  ['days', 'Every Monday Tuesday', 'Every Monday Tuesday'],
  ['day fr', 'Le Mardi Mercredi', 'Le Mardi Mercredi', 'fr'],
  ['sentence start single', 'Yesterday I tried it', 'Yesterday I tried it'],
  ['sentence start the', 'The Company is large', 'The Company is large'],
  ['le monde', 'Le Monde publie souvent', 'Le Monde publie souvent', 'fr'],
  ['plain text', 'I do not use it much', 'I do not use it much'],
  ['short number', 'We have 12 people in 3 teams', 'We have 12 people in 3 teams'],
  ['year', 'In 2024 we started', 'In 2024 we started'],
  ['date iso', 'Done on 2024-03-12', 'Done on 2024-03-12'],
  ['date slash', 'Done on 12/03/2024', 'Done on 12/03/2024'],
  ['date dots', 'Done on 12.03.2024', 'Done on 12.03.2024'],
  ['amount', 'It costs 1 500 euros', 'It costs 1 500 euros'],
  ['percent', 'About 45% of tasks', 'About 45% of tasks'],
  ['iso standard', 'We follow ISO27001 rules', 'We follow ISO27001 rules'],
  ['version', 'We run v2.3.1 of the tool', 'We run v2.3.1 of the tool'],
  ['email word', 'I read my email daily', 'I read my email daily'],
  ['at sign word', 'Meet at 5 pm', 'Meet at 5 pm'],
  ['empty', '', ''],
];

describe('anonymise: masks personal data', () => {
  it.each(CASES)('%s', (_label, input, expected, locale) => {
    expect(run(input, locale ?? 'en', _label === 'term company' ? ['Acme Demo'] : [])).toBe(
      expected,
    );
  });
});

describe('anonymise: keeps ordinary text', () => {
  it.each(FALSE_POSITIVES)('%s', (_label, input, expected, locale) => {
    expect(run(input, locale ?? 'en')).toBe(expected);
  });
});

describe('anonymise: names to hide', () => {
  const terms = ['Demo Client', 'Zeta Tool', 'Équipe Rouge', 'Demo Referent'];
  it('is case and accent insensitive', () => {
    expect(run('equipe rouge et ÉQUIPE ROUGE', 'fr', terms)).toBe(
      '[organisation] et [organisation]',
    );
  });
  it('uses a stable numbered placeholder per term within one answer', () => {
    expect(run('Demo Client, Zeta Tool, Demo Client again', 'en', terms)).toBe(
      '[organisation], [organisation 2], [organisation] again',
    );
  });
  it('respects word boundaries', () => {
    expect(run('we use zeta tooling here', 'en', terms)).toBe('we use zeta tooling here');
  });
  it('matches the longest term first', () => {
    expect(run('Demo Client Group', 'en', ['Demo', 'Demo Client'])).toBe('[organisation] Group');
  });
  it('ignores empty and one-letter terms', () => {
    expect(run('a b c', 'en', ['', ' ', 'a'])).toBe('a b c');
  });
  it('treats regex characters in a term literally', () => {
    expect(run('We use C++ (v2) daily', 'en', ['C++ (v2)'])).toBe('We use [organisation] daily');
  });
});

describe('anonymise: properties', () => {
  const samples = [...CASES, ...FALSE_POSITIVES].map((c) => c[1]);
  it('is idempotent', () => {
    for (const s of samples) {
      for (const locale of ['fr', 'en'] as const) {
        const once = run(s, locale, ['Acme Demo']);
        expect(run(once, locale, ['Acme Demo'])).toBe(once);
      }
    }
  });
  it('counts masked spans without returning values', () => {
    const r = anonymise('Mail a@b.co or call 06 12 34 56 78', { locale: 'en' });
    expect(r.masked).toBe(2);
    expect(r.text).toBe('Mail [email] or call [phone]');
  });
  it('reports zero when nothing is masked', () => {
    expect(anonymise('Nothing to hide here', { locale: 'en' }).masked).toBe(0);
  });
  it('handles decomposed accents', () => {
    expect(run('équipe rouge', 'fr', ['équipe rouge'])).toBe('[organisation]');
  });
  it('is fast on long adversarial input', () => {
    const t0 = Date.now();
    run('Aa '.repeat(1500) + '1 '.repeat(1500));
    run('a@'.repeat(2000));
    run('Monsieur '.repeat(450));
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('never echoes input in an error', () => {
    expect(() => anonymise('x'.repeat(10_000), { locale: 'fr' })).not.toThrow();
  });
});
