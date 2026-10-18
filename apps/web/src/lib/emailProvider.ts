/**
 * Transactional-email provider interface (FR-03, ADR 0033). Two implementations: an in-memory mock
 * for tests and CI, and one real adapter for an EU service (Brevo, France) configured only by env.
 * No key lives in the repo. Unconfigured means "email delivery is unavailable", never a silent
 * fallback to the mock.
 */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class EmailNotConfigured extends Error {
  public readonly code = 'email_not_configured';
  public constructor() {
    super('Email delivery is not configured (EMAIL_PROVIDER, provider key and EMAIL_FROM).');
    this.name = 'EmailNotConfigured';
  }
}

export class MockEmailProvider implements EmailProvider {
  public readonly name = 'mock';
  public readonly sent: EmailMessage[] = [];
  public async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export interface BrevoOptions {
  readonly apiKey: string;
  readonly from: string;
  readonly fromName?: string;
  readonly fetchImpl?: typeof fetch;
}

/** Brevo transactional API (EU-hosted). Body carries no tracking pixels. */
export class BrevoEmailProvider implements EmailProvider {
  public readonly name = 'brevo';
  public constructor(private readonly opts: BrevoOptions) {}
  public async send(message: EmailMessage): Promise<void> {
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.opts.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.opts.from, name: this.opts.fromName ?? 'EvolAI' },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
      }),
    });
    if (!res.ok) throw new Error(`email provider rejected the message (${res.status})`);
  }
}

let override: EmailProvider | null = null;
/** Test hook: install a provider (the mock) for the process. */
export const setEmailProviderForTests = (p: EmailProvider | null): void => {
  override = p;
};

export const resolveEmailProvider = (
  env: Record<string, string | undefined> = process.env,
): EmailProvider => {
  if (override) return override;
  const kind = env['EMAIL_PROVIDER'];
  if (kind === 'mock' && env['NODE_ENV'] !== 'production') return new MockEmailProvider();
  if (kind === 'brevo') {
    const apiKey = env['BREVO_API_KEY'];
    const from = env['EMAIL_FROM'];
    if (apiKey && from) return new BrevoEmailProvider({ apiKey, from });
  }
  throw new EmailNotConfigured();
};
