import { describe, expect, it } from 'vitest';
import { parseNoticeForm, resolveNotice } from './privacyNotice';

const ctx = { organisation: 'Demo Client', retentionDays: 365, dataRegion: 'eu-west' };

describe('resolveNotice', () => {
  it('uses safe defaults and lists what is not configured', () => {
    const n = resolveNotice({}, { ...ctx, retentionDays: null });
    expect(n.controller).toBe('Demo Client');
    expect(n.basis).toBe('consent');
    expect(n.contact).toBeNull();
    expect(n.purpose).toBeNull();
    expect(n.region).toBe('eu-west');
    expect(n.gaps).toEqual(['contact', 'providers', 'retention']);
  });

  it('reads the stored fields and the older contact line', () => {
    const n = resolveNotice(
      {
        notice: {
          controller: 'Demo Org',
          contactName: 'Demo Referent',
          contactEmail: 'privacy@example.test',
          providers: ['Hosting A', ' ', 'Mail B'],
          basis: 'legitimate_interest',
        },
      },
      ctx,
    );
    expect(n).toMatchObject({
      controller: 'Demo Org',
      contact: 'Demo Referent, privacy@example.test',
      contactEmail: 'privacy@example.test',
      providers: ['Hosting A', 'Mail B'],
      basis: 'legitimate_interest',
      gaps: [],
    });
    expect(resolveNotice({ respondentContact: 'Ask the Demo Referent' }, ctx).contact).toBe(
      'Ask the Demo Referent',
    );
  });

  it('shows the AI part only when it is on AND an approved service is named', () => {
    expect(resolveNotice({ notice: { aiOn: true } }, ctx).aiRoute).toBeNull();
    expect(resolveNotice({ notice: { aiOn: true } }, ctx).gaps).toContain('ai');
    expect(resolveNotice({ notice: { aiOn: false, aiRoute: 'Demo AI' } }, ctx).aiRoute).toBeNull();
    expect(resolveNotice({ notice: { aiOn: true, aiRoute: 'Demo AI' } }, ctx).aiRoute).toBe(
      'Demo AI',
    );
  });
});

describe('parseNoticeForm', () => {
  const form = (o: Record<string, string>) => (k: string) => o[k] ?? null;
  it('accepts an empty form (all defaults)', () => {
    const r = parseNoticeForm(form({}));
    expect(r.ok && r.value.basis).toBe('consent');
  });
  it('rejects a bad contact email and over-long text', () => {
    expect(parseNoticeForm(form({ contactEmail: 'nope' }))).toEqual({
      ok: false,
      error: 'contact',
    });
    expect(parseNoticeForm(form({ purpose: 'x'.repeat(601) }))).toEqual({
      ok: false,
      error: 'too_long',
    });
  });
  it('turns the provider lines into a list', () => {
    const r = parseNoticeForm(form({ providers: 'A\r\n\r\nB\n', aiOn: 'on', aiRoute: 'Demo AI' }));
    expect(r.ok && r.value.providers).toEqual(['A', 'B']);
    expect(r.ok && r.value.aiOn).toBe(true);
  });
});
