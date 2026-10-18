import Link from 'next/link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon } from '@evolai/ui';
import { Logo } from '@/components/Logo';
import { getT } from '@/lib/i18n';

const SOURCE_URL = 'https://github.com/angelstreet/evolai';

/** Footer (docs/UI_RULES.md §13): logo mark, trust line, About, Privacy and Source links. */
export default function SiteFooter() {
  const { t } = getT();
  return (
    <Box
      component="footer"
      className="site-footer"
      sx={{ borderTop: 1, borderColor: 'divider', mt: 12 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        className="container footer-row"
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 3, py: 6 }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 3 }}>
          <Logo iconOnly />
          <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
            {t('common.footer.rights')}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          component="nav"
          aria-label={t('common.footer.navAria')}
          sx={{ flexWrap: 'wrap', columnGap: 5, rowGap: 2 }}
        >
          <Link className="nav-link" href="/about">
            {t('common.footer.about')}
          </Link>
          <Link className="nav-link" href="/privacy">
            {t('common.footer.privacy')}
          </Link>
          <a className="nav-link" href={SOURCE_URL} rel="noopener noreferrer">
            <AppIcon name="code" size={16} />
            {t('common.footer.source')}
          </a>
        </Stack>
      </Stack>
    </Box>
  );
}
