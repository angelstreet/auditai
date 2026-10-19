import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { StatusText } from '@evolai/ui';
import { getT } from '@/lib/i18n';

export type ChecklistKey = 'Engagement' | 'Teams' | 'Links' | 'Progress' | 'Results';

export interface ChecklistStep {
  readonly key: ChecklistKey;
  readonly done: boolean;
  readonly href: string;
}

/**
 * First-run guide on the portfolio page (TASK-T, ADR 0038): five steps from an empty account to
 * results. Each step is icon plus word (done or to do) and links to the screen where it happens;
 * the first open step is the one to do next.
 */
export default function FirstRunChecklist({ steps }: { steps: readonly ChecklistStep[] }) {
  const { t } = getT();
  const next = steps.find((s) => !s.done);
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="checklist-title"
      data-testid="first-run-checklist"
      sx={{ p: 4, borderRadius: 3, mb: 6 }}
    >
      <Typography id="checklist-title" variant="sectionTitle" component="h2">
        {t('admin.setup.checklist.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {next ? t('admin.setup.checklist.intro') : t('admin.setup.checklist.allDone')}
      </Typography>
      <Typography component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {steps.map((s, i) => (
          <li
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 44,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ minWidth: 24 }}>{i + 1}.</span>
            <a href={s.href} style={{ flex: 1, minWidth: 180 }}>
              {t(`admin.setup.checklist.step${s.key}` as 'admin.setup.checklist.stepLinks')}
            </a>
            <StatusText status={s.done ? 'success' : 'pending'}>
              {s.done ? t('admin.setup.checklist.done') : t('admin.setup.checklist.todo')}
            </StatusText>
            {next?.key === s.key ? (
              <Button variant="outlined" size="small" href={s.href}>
                {t('admin.setup.checklist.next')}
              </Button>
            ) : null}
          </li>
        ))}
      </Typography>
    </Paper>
  );
}
