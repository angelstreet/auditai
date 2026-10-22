import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, type IconName } from '@evolai/ui';
import { formatDate, type SupportedLocale, type Translator } from '@evolai/i18n';
import PrivacyNotice from '@/components/respondent/PrivacyNotice';
import ProgressBar from '@/components/ProgressBar';
import type { TeamProgress } from '@/lib/respondent';

interface Props {
  /** For the privacy notice: opens the organisation's details and the request form. */
  engagementId: string;
  title: string;
  team: TeamProgress;
  locale: SupportedLocale;
  t: Translator;
}

/** "1 November" / "1er novembre": French writes the first of the month as an ordinal. */
const dayMonth = (locale: SupportedLocale, iso: string): string => {
  const text = formatDate(locale, iso, { day: 'numeric', month: 'long' });
  return locale === 'fr' ? text.replace(/^1 /, '1er ') : text;
};

const nextStep = (team: TeamProgress, locale: SupportedLocale, t: Translator): string => {
  switch (team.engagementStatus) {
    case 'analysis':
    case 'review':
      return t('survey.nextClosed');
    case 'closed':
    case 'archived':
      return t('survey.nextDone');
    default:
      return team.closesAt
        ? t('survey.nextOpenUntil', { date: dayMonth(locale, team.closesAt) })
        : t('survey.nextOpen');
  }
};

/**
 * "How is my team doing, what happens next" (done page and return visit). One glance: the team
 * answer count and one sentence on the next step; the page ends calm, no quiz (TASK-AD2). Counts only, never
 * names or answers (PRD §4.3, §15).
 */
export default function RespondentStatus({
  engagementId,
  title,
  team,
  locale,
  t,
}: Props) {
  const steps: ReadonlyArray<{ icon: IconName; text: string }> = [
    { icon: 'success', text: t('survey.nextSaved') },
    { icon: 'time', text: nextStep(team, locale, t) },
    { icon: 'lock', text: t('survey.keepLink') },
  ];
  const teamLine = t('survey.teamProgress', { done: team.answered, total: team.invited });
  return (
    <Stack sx={{ gap: 6 }}>
      {/* Wraps at 200% zoom (180 px) instead of scrolling sideways. */}
      <Stack direction="row" sx={{ gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ color: 'success.main', display: 'flex' }}>
          <AppIcon name="success" size={40} />
        </Box>
        <Typography
          id="status-title"
          variant="pageTitle"
          component="h1"
          sx={{ m: 0, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
      </Stack>

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="team-title"
        sx={{ p: 5, borderRadius: 3 }}
      >
        <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 3 }}>
          <AppIcon name="team" />
          <Typography id="team-title" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
            {t('survey.teamHeading')}
          </Typography>
        </Stack>
        <Typography variant="body1" component="p" sx={{ fontWeight: 600, mt: 0, mb: 3 }}>
          {teamLine}
        </Typography>
        <ProgressBar
          current={team.answered}
          total={team.invited}
          ariaLabel={t('survey.teamProgressAria')}
          valueText={teamLine}
        />
      </Paper>

      <section aria-labelledby="next-title">
        <Typography id="next-title" variant="sectionTitle" component="h2" sx={{ m: 0, mb: 3 }}>
          {t('survey.nextHeading')}
        </Typography>
        <Stack component="ol" sx={{ listStyle: 'none', p: 0, m: 0, gap: 3 }}>
          {steps.map((step) => (
            <Stack
              key={step.icon}
              component="li"
              direction="row"
              sx={{ gap: 3, alignItems: 'flex-start' }}
            >
              <Box sx={{ color: 'primary.main', display: 'flex', pt: 0.5 }}>
                <AppIcon name={step.icon} />
              </Box>
              <Typography variant="body1" component="span">
                {step.text}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography variant="body2" component="p" color="text.secondary" sx={{ mt: 4, mb: 0 }}>
          {team.contact
            ? t('survey.contactWith', { contact: team.contact })
            : t('survey.contactNone')}
        </Typography>
      </section>

      <Paper
        component="section"
        elevation={0}
        aria-labelledby="tip-title"
        sx={{ p: 5, borderRadius: 3, bgcolor: 'app.raised' }}
      >
        <Typography id="tip-title" variant="sectionTitle" component="h2" sx={{ m: 0, mb: 2 }}>
          {t('survey.tipHeading')}
        </Typography>
        <Typography variant="body2" component="p" color="text.secondary" sx={{ m: 0 }}>
          {t('survey.tip')}
        </Typography>
      </Paper>
      <PrivacyNotice t={t} engagementId={engagementId} />
    </Stack>
  );
}
