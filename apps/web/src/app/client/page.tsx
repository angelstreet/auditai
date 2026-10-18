import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, EmptyState, IconTile, PageTitle, StatTiles, StatusText } from '@evolai/ui';
import { requireClientContext } from '@/lib/clientContext';
import {
  loadClientSurvey,
  loadPublishedResults,
  loadTeamNames,
  nextStep,
  teamProgress,
} from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = new Set([
  'draft',
  'scheduled',
  'in_field',
  'analysis',
  'review',
  'closed',
  'archived',
]);

const CTA = {
  create: { href: '/client/invitations', key: 'create' },
  remind: { href: '/client/invitations#reminders', key: 'remind' },
  wait: null,
  results: { href: '/client/results', key: 'results' },
} as const;

/**
 * Team space home (TASK-P): completion counts for the referent's team only (with the fewer than
 * five rule), a plain status line, and the one thing to do next.
 */
export default async function ClientHome() {
  const { ctx } = await requireClientContext();
  const { t } = getT();
  const teams = await loadTeamNames(ctx.tenantId, ctx.teamIds);
  const teamName = teams.join(', ');
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) {
    return (
      <section aria-labelledby="client-title">
        <PageTitle
          id="client-title"
          title={t('client.home.title')}
          subtitle={t('client.home.subtitle', { team: teamName })}
        />
        <EmptyState icon="pending" title={t('client.home.noSurvey')} />
      </section>
    );
  }
  const [rows, results] = await Promise.all([
    teamProgress(ctx.tenantId, survey.engagementId, ctx.teamIds),
    loadPublishedResults(ctx.tenantId, survey.engagementId),
  ]);
  const hasResults = results.themes.length > 0 || results.opportunities.length > 0;
  const step = nextStep(survey.status, rows, hasResults);
  const cta = CTA[step];
  const fewer = t('client.home.fewerThan', { n: MIN_GROUP_SIZE });
  const invited = rows.reduce((n, r) => n + r.invited, 0);
  const anySuppressed = rows.some((r) => r.suppressed);
  const sum = (pick: (r: Extract<(typeof rows)[number], { suppressed: false }>) => number) =>
    anySuppressed
      ? fewer
      : String(
          rows.reduce((n, r) => (r.suppressed ? n : n + pick(r)), 0),
        );
  const statusKey = STATUS_KEYS.has(survey.status) ? survey.status : 'none';
  return (
    <section aria-labelledby="client-title">
      <PageTitle
        id="client-title"
        title={t('client.home.title')}
        subtitle={t('client.home.subtitle', { team: teamName })}
      />
      <Typography variant="body1" sx={{ mb: 4 }} data-testid="client-status">
        <StatusText status={statusKey === 'closed' ? 'success' : 'running'}>
          {t('client.home.statusLabel')}: {survey.name} ·{' '}
          {t(`client.home.status.${statusKey}` as 'client.home.status.none')}
        </StatusText>
      </Typography>
      <StatTiles
        items={[
          { label: t('client.home.tiles.invited'), value: String(invited) },
          { label: t('client.home.tiles.started'), value: sum((r) => r.started) },
          {
            label: t('client.home.tiles.completed'),
            value: sum((r) => r.completed),
            hint: anySuppressed ? t('client.home.fewerThanHint', { n: MIN_GROUP_SIZE }) : undefined,
          },
        ]}
      />
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-next">
        <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
          <IconTile name={step === 'results' ? 'results' : step === 'wait' ? 'time' : 'forward'} />
          <div>
            <Typography variant="cardTitle" component="h2" sx={{ m: 0 }}>
              {t('client.home.nextTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 1 }}>
              {t(`client.home.next.${step}`)}
            </Typography>
          </div>
        </Stack>
        {cta ? (
          <Button
            variant="contained"
            href={cta.href}
            endIcon={<AppIcon name="forward" size={16} />}
            sx={{ mt: 6, minHeight: 44 }}
          >
            {t(`client.home.cta.${cta.key}`)}
          </Button>
        ) : null}
      </Paper>
    </section>
  );
}
