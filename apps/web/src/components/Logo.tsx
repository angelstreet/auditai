import type { CSSProperties } from 'react';

/**
 * EvolAI logo and wordmark component (M8 rebrand).
 *
 * Renders the adaptive-steps symbol (three leaves, ascending amber → blue → teal)
 * plus the "EvolAI" wordmark with "AI" highlighted in the brand teal.
 *
 * Two sizes:
 *   - default  (36px icon + text-lg wordmark) for the top navigation
 *   - "hero"   (64px icon + text-2xl wordmark) for the about / landing pages
 *
 * The icon is drawn from the brand kit palette (amber, blue, teal, deep navy tokens).
 * The wordmark uses the same navy with the "AI" portion rendered in teal.
 */

interface LogoProps {
  size?: 'default' | 'hero';
  /**
   * If `true`, render only the icon (no wordmark). Useful for favicons or compact
   * navigation in the future.
   */
  iconOnly?: boolean;
  className?: string;
  style?: CSSProperties;
}

const ICON_SIZES = {
  default: 36,
  hero: 64,
} as const;

const WORDMARK_SIZES = {
  default: '--text-lg',
  hero: '--text-2xl',
} as const;

// Colours come from the design tokens (packages/ui/src/tokens.css, ADR 0025).
const AMBER = 'var(--color-amber)';
const BLUE = 'var(--color-blue)';
const TEAL = 'var(--color-teal)';
// Teal text on white fails 4.5:1; the wordmark uses the teal-ink text tone (ADR 0025).
const TEAL_INK = 'var(--color-accent-ink)';
// Wordmark follows the text colour so it reads in light and dark (ADR 0034).
const NAVY = 'var(--color-fg)';

export function Logo({ size = 'default', iconOnly = false, className, style }: LogoProps) {
  const iconSize = ICON_SIZES[size];
  const wordmarkSize = WORDMARK_SIZES[size];
  return (
    <span
      className={['brand', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: iconSize * 0.33,
        color: NAVY,
        fontWeight: 700,
        fontSize: `var(${wordmarkSize})`,
        lineHeight: 1,
        letterSpacing: '-0.01em',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 60 60"
        width={iconSize}
        height={iconSize}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 50 C 6 50, 2 38, 10 30 C 16 24, 22 26, 26 32 C 28 36, 28 44, 22 48 C 20 49.5, 18 50, 16 50 Z"
          fill={AMBER}
        />
        <path
          d="M28 44 C 18 44, 14 30, 22 22 C 28 16, 34 18, 38 24 C 40 28, 40 38, 34 42 C 32 43.5, 30 44, 28 44 Z"
          fill={BLUE}
        />
        <path
          d="M40 38 C 28 38, 24 22, 32 12 C 38 4, 46 6, 50 14 C 52 18, 52 30, 46 36 C 44 37.5, 42 38, 40 38 Z"
          fill={TEAL}
        />
      </svg>
      {!iconOnly && (
        <span style={{ whiteSpace: 'nowrap' }}>
          Evol<span style={{ color: TEAL_INK }}>AI</span>
        </span>
      )}
    </span>
  );
}
