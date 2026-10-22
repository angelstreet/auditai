import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ChoiceCounts } from '@/lib/answersData';

/**
 * One horizontal bar chart for one choice question (TASK-AD2): a label, a bar as long as its
 * share, and the count. Plain boxes coloured from the theme, so it prints and follows dark mode.
 */
export default function ChoiceBars({
  choice,
  peopleLabel,
  ariaLabel,
  headingLevel = 'h3',
}: {
  choice: ChoiceCounts;
  peopleLabel: (n: number) => string;
  ariaLabel: string;
  headingLevel?: 'h3' | 'h4';
}) {
  const max = Math.max(1, ...choice.counts.map((c) => c.n));
  return (
    <Box component="figure" sx={{ m: 0, mb: 5, breakInside: 'avoid' }} aria-label={ariaLabel}>
      <Typography variant="cardTitle" component={headingLevel} sx={{ m: 0, mb: 2 }}>
        {choice.question}
      </Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
        {choice.counts.map((c) => (
          <Box
            key={c.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(0, 3fr)' },
              columnGap: 3,
              alignItems: 'center',
            }}
          >
            <Typography component="dt" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {c.label}
            </Typography>
            <Box component="dd" sx={{ m: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                aria-hidden
                sx={{
                  height: 12,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  width: `${Math.max(2, (c.n / max) * 100)}%`,
                  maxWidth: 'calc(100% - 7rem)',
                  printColorAdjust: 'exact',
                  WebkitPrintColorAdjust: 'exact',
                }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                {peopleLabel(c.n)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
