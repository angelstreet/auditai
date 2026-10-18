import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyState } from '@evolai/ui';
import type { Translator } from '@evolai/i18n';

/** Expired or withdrawn invitation: say so plainly and give the one next action (PRD §16). */
export default function LinkProblem({ gate, t }: { gate: 'expired' | 'withdrawn'; t: Translator }) {
  return (
    <Stack component="section" aria-labelledby="link-problem-title" sx={{ gap: 6 }}>
      <Typography id="link-problem-title" variant="pageTitle" component="h1" sx={{ m: 0 }}>
        {gate === 'expired' ? t('survey.expiredTitle') : t('survey.withdrawnTitle')}
      </Typography>
      <EmptyState icon="linkBroken" title={t('survey.askNewLink')} />
    </Stack>
  );
}
