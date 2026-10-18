import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, Mascot, type IconName } from '@evolai/ui';
import { formatDate, type SupportedLocale, type Translator } from '@evolai/i18n';
import type { MascotTier } from '@evolai/contracts';
import ProgressBar from '@/components/ProgressBar';
import type { TeamProgress } from '@/lib/respondent';

interface Props {
  token: string;
  title: string;
  team: TeamProgress;
  myTier: MascotTier | null;
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
 * answer count, one sentence on the next step, and the optional mascot quiz. Counts only, never
 * names or answers (PRD §4.3, §15).
 */
export default function RespondentStatus({ token, title, team, myTier, locale, t }: Props) {
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
        {team.teamTier ? (
          <p className="inline-mascot">
            <Mascot tier={team.teamTier} size={40} label={t(`quiz.mascotAlt.${team.teamTier}`)} />
            {t('survey.teamMascot', { tier: t(`quiz.tier.${team.teamTier}`) })}
          </p>
        ) : null}
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
        id="mascot"
        variant="outlined"
        aria-labelledby="mascot-title"
        sx={{ p: 5, borderRadius: 3 }}
      >
        {myTier ? (
          <>
            <Typography
              id="mascot-title"
              variant="sectionTitle"
              component="h2"
              className="inline-mascot"
              sx={{ m: 0 }}
            >
              <Mascot tier={myTier} size={64} label={t(`quiz.mascotAlt.${myTier}`)} />
              {t('survey.yourMascot', { tier: t(`quiz.tier.${myTier}`) })}
            </Typography>
            <Typography variant="body1" component="p" sx={{ mt: 3, mb: 2 }}>
              {t(`quiz.tierDescriptor.${myTier}`)}
            </Typography>
            <Typography variant="body2" component="p" color="text.secondary" sx={{ mt: 0, mb: 4 }}>
              {t('quiz.mascotIntro')}
            </Typography>
            <Button variant="outlined" href={`/s/${token}/quiz`}>
              {t('survey.retakeQuiz')}
            </Button>
          </>
        ) : (
          <>
            <Typography id="mascot-title" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
              {t('survey.quizTitle')}
            </Typography>
            <Typography variant="body1" component="p" sx={{ mt: 3, mb: 4 }}>
              {t('survey.quizBody')}
            </Typography>
            <Button variant="contained" href={`/s/${token}/quiz`}>
              {t('survey.quizCta')}
            </Button>
          </>
        )}
      </Paper>

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
    </Stack>
  );
}
