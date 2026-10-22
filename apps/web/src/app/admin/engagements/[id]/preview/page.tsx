import Link from 'next/link';
import { notFound } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageTitle } from '@evolai/ui';
import { createTranslator } from '@evolai/i18n';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { getEngagementSetup } from '@/lib/setupData';
import {
  SYNTHETIC_QUESTIONS,
  freeTextHint,
  surveyEstimatedMinutes,
  totalQuestionCount,
} from '@/lib/syntheticTemplate';

export const dynamic = 'force-dynamic';

/**
 * /admin/engagements/[id]/preview: the survey as respondents see it, in the engagement language,
 * read only. No token, no submission, nothing is written (TASK-T, ADR 0038).
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tenant?: string };
}) {
  const { t, locale } = getT();
  if (!isUuid(params.id)) notFound();
  const tenants = await sessionTenantIds();
  const current = tenants.find((x) => x === searchParams.tenant) ?? tenants[0];
  if (!current) notFound();
  const setup = await getEngagementSetup(current, params.id);
  if (!setup) notFound();
  // The preview speaks the engagement language, whatever the auditor's own interface language is.
  const r = createTranslator(setup.locale);
  const total = totalQuestionCount();
  return (
    <section className="wide admin" aria-labelledby="preview-title" lang={setup.locale}>
      <Link href={`/admin/engagements/${setup.id}/settings?tenant=${current}`} lang={locale}>
        {t('admin.setup.preview.back')}
      </Link>
      <PageTitle level="h2"
        id="preview-title"
        title={t('admin.setup.preview.title')}
        subtitle={t('admin.setup.preview.intro')}
      />
      <Alert severity="info" sx={{ mb: 4 }}>
        {t('admin.setup.preview.banner')}{' '}
        {t('admin.setup.preview.langLabel', { locale: t(`common.language.${setup.locale}`) })}
      </Alert>
      <Stack sx={{ gap: 4, maxWidth: 720 }}>
        <Paper variant="outlined" component="article" sx={{ p: 5, borderRadius: 4 }}>
          <Typography variant="pageTitle" component="h2" sx={{ m: 0 }}>
            {r('survey.title')}
          </Typography>
          <Typography variant="lede" component="p" color="text.secondary" sx={{ mt: 3 }}>
            {r('survey.lede')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {r('survey.duration', { n: total, m: surveyEstimatedMinutes() })}
          </Typography>
          <Typography variant="body2" sx={{ mt: 3 }}>
            {r('survey.privacyShort')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {r('survey.howItWorks')}
          </Typography>
        </Paper>
        {SYNTHETIC_QUESTIONS.map((q, i) => (
          <Paper key={q.id} variant="outlined" component="article" sx={{ p: 5, borderRadius: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
              {r('survey.questionOf', { i: i + 1, n: total })}
            </Typography>
            <Typography variant="sectionTitle" component="h3" sx={{ mt: 1 }}>
              {q.prompt[setup.locale]}
            </Typography>
            {q.helper[setup.locale] ? (
              <Typography color="text.secondary">{q.helper[setup.locale]}</Typography>
            ) : null}
            {q.kind === 'short_text' ? (
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                {r('survey.optional')} · {freeTextHint(setup.locale)}
              </Typography>
            ) : null}
            <Stack component="ul" sx={{ p: 0, m: 0, mt: 2, gap: 1, listStyle: 'none' }}>
              {q.options.map((o) => (
                <Typography key={o.value} component="li" sx={{ py: 1 }}>
                  {o.label[setup.locale]}
                </Typography>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </section>
  );
}
