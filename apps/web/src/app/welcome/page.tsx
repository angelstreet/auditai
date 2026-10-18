import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TenantId } from '@evolai/contracts';
import { AppIcon, IconTile, Mascot, type IconName } from '@evolai/ui';
import { listTenantIds } from '@/lib/adminData';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.welcome') };
}

const STEPS: ReadonlyArray<{ icon: IconName; n: 1 | 2 | 3 | 4 }> = [
  { icon: 'scene', n: 1 },
  { icon: 'listen', n: 2 },
  { icon: 'review', n: 3 },
  { icon: 'act', n: 4 },
];

/**
 * Public welcome (docs/UI_GLOWUP_PLAN.md §2): a product page, not a document. Hero with a
 * two-line headline, one-line subtitle, one primary action and one secondary link, a visual;
 * then four one-line benefit tiles and a trust line. Footer comes from the layout.
 */
export default async function WelcomePage() {
  const { t } = getT();
  const tenants = await listTenantIds();
  const current = (tenants[0] ?? '11111111-1111-4111-8111-111111111111') as TenantId;
  return (
    <div className="wide">
      <Box
        component="section"
        aria-labelledby="welcome-title"
        sx={{
          display: 'grid',
          gap: { xs: 8, md: 12 },
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
          alignItems: 'center',
          pt: { xs: 4, md: 12 },
          pb: { xs: 10, md: 16 },
        }}
      >
        <Box>
          <Typography
            id="welcome-title"
            variant="pageTitle"
            component="h1"
            sx={{ m: 0, maxWidth: '20ch', fontSize: { md: 'var(--text-2xl)' } }}
          >
            {t('welcome.heading')}
          </Typography>
          <Typography
            variant="lede"
            component="p"
            color="text.secondary"
            sx={{ mt: 4, mb: 0, maxWidth: '44ch' }}
          >
            {t('welcome.lede')}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ mt: 8, gap: 3, alignItems: { sm: 'center' } }}
          >
            <Button
              variant="contained"
              size="large"
              href={`/intake?tenant=${current}`}
              endIcon={<AppIcon name="forward" />}
            >
              {t('welcome.ctaIntake')}
            </Button>
            <Button variant="text" size="large" href="#how">
              {t('welcome.ctaHow')}
            </Button>
          </Stack>
        </Box>
        <Paper
          variant="outlined"
          role="img"
          aria-label={t('welcome.visualAlt')}
          sx={{
            borderRadius: 4,
            p: { xs: 6, md: 10 },
            bgcolor: 'app.raised',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: { xs: 3, md: 5 },
            minHeight: { xs: 200, md: 320 },
          }}
        >
          {(['tortoise', 'fox', 'owl'] as const).map((tier, i) => (
            <Box key={tier} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Mascot tier={tier} size={72 + i * 16} label="" />
              <Box
                aria-hidden
                sx={{
                  mt: 2,
                  width: { xs: 72, md: 96 },
                  height: 16 + i * 28,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
              />
            </Box>
          ))}
        </Paper>
      </Box>

      <Box component="section" id="how" aria-labelledby="how-title" sx={{ scrollMarginTop: 80 }}>
        <Typography id="how-title" variant="sectionTitle" component="h2" sx={{ m: 0, mb: 6 }}>
          {t('welcome.stepsTitle')}
        </Typography>
        <Box
          component="ol"
          aria-label={t('welcome.stepsAria')}
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            display: 'grid',
            gap: 4,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          }}
        >
          {STEPS.map(({ icon, n }) => (
            <Paper component="li" key={n} variant="outlined" sx={{ p: 5, borderRadius: 3 }}>
              <IconTile name={icon} />
              <Typography variant="cardTitle" component="h3" sx={{ mt: 4, mb: 1 }}>
                {t(`welcome.step${n}Title`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
                {t(`welcome.step${n}Body`)}
              </Typography>
            </Paper>
          ))}
        </Box>
        <Stack
          direction="row"
          sx={{ mt: 8, gap: 2, alignItems: 'center', color: 'text.secondary' }}
        >
          <AppIcon name="privacy" />
          <Typography variant="body2" sx={{ m: 0 }}>
            {t('welcome.trust')}
          </Typography>
        </Stack>
      </Box>
    </div>
  );
}
