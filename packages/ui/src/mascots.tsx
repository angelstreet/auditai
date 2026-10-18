import type { MascotTier } from '@evolai/contracts';

/**
 * Inline SVG mascots (M14, PRD \u00a76, \u00a79, \u00a715).
 *
 * No emoji, no external image. Every mascot is rendered server-side from
 * a single React component so the same shape appears on every page and
 * survives the auditor / respondent rendering paths.
 *
 * Colours follow the brand palette from M8 (Deep Navy / Teal / Supporting):
 *   tortoise = Supporting (slow, careful)
 *   fox      = Amber        (pragmatic, learning)
 *   owl      = Teal         (engaged, confident)
 *
 * The component takes `size` (a width/height in px) and `label` so the SVG
 * is accessible by default.
 */

interface MascotProps {
  readonly tier: MascotTier;
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_SIZE = 96;

const TorToiseSvg = ({
  size,
  label,
  className,
}: {
  size: number;
  label: string;
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    role="img"
    aria-label={label}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{label}</title>
    {/* Shell */}
    <ellipse cx="50" cy="60" rx="36" ry="28" fill="#172B3A" />
    <path d="M14 60 H86" stroke="#19A999" strokeWidth="3" fill="none" />
    <path d="M50 32 V88" stroke="#19A999" strokeWidth="3" fill="none" />
    <ellipse cx="50" cy="60" rx="14" ry="14" fill="#19A999" />
    <ellipse cx="50" cy="60" rx="6" ry="6" fill="#FBF7EE" />
    {/* Head + legs */}
    <circle cx="78" cy="50" r="9" fill="#3D5666" />
    <circle cx="76" cy="48" r="1.6" fill="#FBF7EE" />
    <rect x="20" y="86" width="8" height="8" fill="#3D5666" />
    <rect x="40" y="86" width="8" height="8" fill="#3D5666" />
    <rect x="60" y="86" width="8" height="8" fill="#3D5666" />
  </svg>
);

const FoxSvg = ({
  size,
  label,
  className,
}: {
  size: number;
  label: string;
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    role="img"
    aria-label={label}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{label}</title>
    {/* Body */}
    <ellipse cx="50" cy="58" rx="34" ry="24" fill="#E08A1A" />
    {/* White belly */}
    <ellipse cx="50" cy="62" rx="20" ry="14" fill="#FBF7EE" />
    {/* Head */}
    <circle cx="74" cy="44" r="10" fill="#E08A1A" />
    <circle cx="76" cy="42" r="1.8" fill="#172B3A" />
    {/* Ears */}
    <polygon points="66,30 70,18 78,28" fill="#E08A1A" />
    <polygon points="82,30 88,18 90,28" fill="#E08A1A" />
    {/* Tail */}
    <path d="M14 60 Q4 56 8 70 Q14 80 24 70 Z" fill="#E08A1A" />
    <path d="M14 70 Q12 72 16 74" stroke="#FBF7EE" strokeWidth="2" fill="none" />
  </svg>
);

const OwlSvg = ({
  size,
  label,
  className,
}: {
  size: number;
  label: string;
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    role="img"
    aria-label={label}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{label}</title>
    {/* Body */}
    <ellipse cx="50" cy="60" rx="32" ry="30" fill="#19A999" />
    {/* Belly plumage */}
    <path d="M28 56 Q50 80 72 56" stroke="#FBF7EE" strokeWidth="2" fill="none" />
    <path d="M28 66 Q50 90 72 66" stroke="#FBF7EE" strokeWidth="2" fill="none" />
    {/* Eyes (white discs with navy pupils) */}
    <circle cx="40" cy="46" r="10" fill="#FBF7EE" />
    <circle cx="60" cy="46" r="10" fill="#FBF7EE" />
    <circle cx="40" cy="46" r="3" fill="#172B3A" />
    <circle cx="60" cy="46" r="3" fill="#172B3A" />
    {/* Beak */}
    <polygon points="48,52 52,52 50,58" fill="#E08A1A" />
    {/* Ear tufts */}
    <polygon points="32,32 36,22 40,32" fill="#19A999" />
    <polygon points="60,32 64,22 68,32" fill="#19A999" />
  </svg>
);

const labelFor = (tier: MascotTier): string => {
  switch (tier) {
    case 'tortoise':
      return 'Tortoise mascot \u2014 cautious, learning the basics';
    case 'fox':
      return 'Fox mascot \u2014 pragmatic, regular AI explorer';
    case 'owl':
      return 'Owl mascot \u2014 engaged, confident AI practitioner';
  }
};

export function Mascot({ tier, size = DEFAULT_SIZE, label, className }: MascotProps): JSX.Element {
  const text = label ?? labelFor(tier);
  const svgByTier: Record<MascotTier, JSX.Element> = {
    tortoise: <TorToiseSvg size={size} label={text} className={className} />,
    fox: <FoxSvg size={size} label={text} className={className} />,
    owl: <OwlSvg size={size} label={text} className={className} />,
  };
  return svgByTier[tier];
}
