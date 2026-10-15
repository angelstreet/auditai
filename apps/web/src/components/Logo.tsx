import type { CSSProperties } from 'react';

/**
 * EvolAI logo and wordmark component (M8 rebrand).
 *
 * Renders the adaptive-steps symbol (three leaves, ascending amber → blue → teal)
 * plus the "EvolAI" wordmark with "AI" highlighted in the brand teal.
 *
 * Two sizes:
 *   - default  (36px icon + 20px wordmark) for the top navigation
 *   - "hero"   (64px icon + 36px wordmark) for the about / landing pages
 *
 * The icon is drawn from the brand kit palette: amber #FFB86A, blue #4A7FE8,
 * teal #19A999, deep navy #172B3A. The wordmark uses the same navy with the "AI"
 * portion rendered in teal for visual continuity.
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
  default: 20,
  hero: 36,
} as const;

const AMBER = '#FFB86A';
const BLUE = '#4A7FE8';
const TEAL = '#19A999';
const NAVY = '#172B3A';

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
        fontSize: wordmarkSize,
        lineHeight: 1,
        letterSpacing: '-0.01em',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
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
          Evol<span style={{ color: TEAL }}>AI</span>
        </span>
      )}
    </span>
  );
}

export const BRAND_COLORS = {
  navy: NAVY,
  teal: TEAL,
  blue: BLUE,
  amber: AMBER,
  offWhite: '#F7FAFC',
  supporting: '#536575',
} as const;
