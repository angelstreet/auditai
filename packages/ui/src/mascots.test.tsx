import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mascot } from './mascots.jsx';
import type { MascotTier } from '@evolai/contracts';

/**
 * The mascots must be inline SVG so they work without external image
 * requests, and never rely on emoji. We snapshot-assert the rendered
 * markup so an accidental emoji swap or external URL is caught.
 */
describe('M14 mascot SVGs (PRD \u00a76)', () => {
  const tiers: ReadonlyArray<MascotTier> = ['tortoise', 'fox', 'owl'];
  for (const tier of tiers) {
    it(`renders ${tier} as inline SVG with the right aria-label`, () => {
      const html = renderToStaticMarkup(<Mascot tier={tier} label={`test ${tier}`} />);
      expect(html.startsWith('<svg')).toBe(true);
      expect(html).toContain('aria-label="test ' + tier + '"');
      // No emoji anywhere.
      expect(
        /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}]/u.test(html),
      ).toBe(false);
      // No external image request and no external link.
      expect(html).not.toContain('<img');
      // The xmlns URI is intentional; that doesn't count as a remote URL.
      // What would count is an actual attribute that fetches a resource:
      expect(html).not.toContain('xlink:href');
      expect(html).not.toContain('href="http');
      expect(html).not.toContain("href='http");
    });
  }

  it('falls back to a default label when none is supplied', () => {
    const html = renderToStaticMarkup(<Mascot tier="fox" />);
    expect(html).toContain('Fox mascot');
  });
});
