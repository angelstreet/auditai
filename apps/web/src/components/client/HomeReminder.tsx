'use client';

import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { useLinkActions } from '@/components/LinkActions';

/**
 * The reminder on the referent home (TASK-Z1): the day to send it and one button that copies the
 * ready message. Editing, email and WhatsApp stay on the Invitations page.
 */
export default function HomeReminder({
  date,
  today,
  text,
}: {
  /** Suggested day in words, or null when none is left. */
  date: string | null;
  /** The suggested day is today (or just passed): send it now. */
  today: boolean;
  text: string;
}) {
  const { t } = useI18n();
  const actions = useLinkActions();
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-home-reminder">
      <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {t('client.home.reminder.title')}
      </Typography>
      <Typography variant="body1" sx={{ mt: 2, mb: 0 }} data-testid="client-home-reminder-date">
        {today
          ? t('client.home.reminder.today')
          : date
            ? t('client.home.reminder.on', { date })
            : t('client.home.reminder.none')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          onClick={() => void actions.copy(text, t('client.invitations.copied'))}
          startIcon={<AppIcon name="copy" size={16} />}
          data-testid="client-home-reminder-copy"
          sx={{ minHeight: 44 }}
        >
          {t('client.invitations.remindCopy')}
        </Button>
        <Button variant="text" href="/client/invitations#reminder" sx={{ minHeight: 44 }}>
          {t('client.home.reminder.edit')}
        </Button>
      </Stack>
      {actions.dialog}
    </Paper>
  );
}
