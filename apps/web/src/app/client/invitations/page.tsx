import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { headers } from 'next/headers';
import type { TenantId } from '@evolai/contracts';
import { EmptyState, PageTitle } from '@evolai/ui';
import ReminderCard from '@/components/client/ReminderCard';
import ShareLinks from '@/components/client/ShareLinks';
import { requireClientContext } from '@/lib/clientContext';
import { firstLinkOn, loadClientSurvey, loadTeamNames } from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { listTeamLinks } from '@/lib/invitationData';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import { longDate, prepareMessages } from '@/lib/referentMessages';
import { contactFor, reminderPlan } from '@/lib/referentView';
import { estimatedMinutes } from '@/lib/respondent';
import { totalQuestionCount } from '@/lib/syntheticTemplate';
import CreateLinksForm from './CreateLinksForm';

export const dynamic = 'force-dynamic';

/**
 * Team space invitations (TASK-P, TASK-S, ADR 0039): create links, see and share every link of the
 * team with a ready-made message, and one generic reminder with suggested days. Nothing on this
 * page depends on who answered: the referent knows which link went to whom.
 */
export default async function ClientInvitations() {
  const { session, ctx } = await requireClientContext();
  const { t, locale } = getT();
  const teamName = (await loadTeamNames(ctx.tenantId, ctx.teamIds)).join(', ');
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const title = (
    <PageTitle
      id="client-inv-title"
      title={t('client.invitations.title')}
      subtitle={t('client.invitations.subtitle', { team: teamName })}
    />
  );
  if (!survey) {
    return (
      <section aria-labelledby="client-inv-title">
        {title}
        <EmptyState icon="pending" title={t('client.home.noSurvey')} />
      </section>
    );
  }
  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const [links, firstOn] = await Promise.all([
    listTeamLinks(ctx.tenantId as TenantId, survey.engagementId, baseUrl, ctx.teamIds),
    firstLinkOn(ctx.tenantId, survey.engagementId, ctx.teamIds),
  ]);
  const facts = {
    closesOn: survey.closesOn,
    contact: contactFor(survey.contact, ctx.viewAs?.label ?? session.name),
    minutes: estimatedMinutes(totalQuestionCount()),
  };
  const fr = prepareMessages('fr', facts);
  const en = prepareMessages('en', facts);
  const today = new Date().toISOString().slice(0, 10);
  const plan = reminderPlan({
    closesOn: survey.closesOn,
    firstLinkOn: firstOn,
    schedule: survey.reminderDays,
    today,
  });
  const when: string[] = [];
  if (plan.dates.length === 0) when.push(t('client.invitations.remindNoDate'));
  else {
    if (plan.due) when.push(t('client.invitations.remindToday'));
    when.push(
      t('client.invitations.remindWhen', {
        dates: plan.dates.map((d) => longDate(locale, d)).join(', '),
      }),
    );
    if (plan.next && plan.next > today) {
      when.push(t('client.invitations.remindNext', { date: longDate(locale, plan.next) }));
    } else if (!plan.due) when.push(t('client.invitations.remindDone'));
  }
  return (
    <section aria-labelledby="client-inv-title">
      {title}
      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 4 }}>
            {t('client.invitations.createTitle')}
          </Typography>
          <CreateLinksForm readOnly={ctx.readOnly} teams={survey.teams} />
        </Paper>
        <ShareLinks
          links={links.map((l) => l.link)}
          messages={{ fr: fr.invite, en: en.invite }}
          defaultLang={locale}
        />
        {links.length > 0 ? (
          <ReminderCard
            message={locale === 'fr' ? fr.reminder : en.reminder}
            when={when}
            due={plan.due}
          />
        ) : null}
      </Stack>
    </section>
  );
}
