import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyState } from '@evolai/ui';
import { getT } from '@/lib/i18n';

/** Unknown page or a broken invitation link: plain words and the one next action. */
export default function NotFound() {
  const { t } = getT();
  return (
    <Stack component="section" aria-labelledby="not-found-title" sx={{ gap: 6 }}>
      <Typography id="not-found-title" variant="pageTitle" component="h1" sx={{ m: 0 }}>
        {t('common.notFoundTitle')}
      </Typography>
      <EmptyState
        icon="linkBroken"
        title={t('common.notFoundBody')}
        action={
          <Button variant="contained" href="/">
            {t('common.notFoundHome')}
          </Button>
        }
      />
    </Stack>
  );
}
