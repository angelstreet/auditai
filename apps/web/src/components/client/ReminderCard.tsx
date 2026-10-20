'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { useLinkActions } from '@/components/LinkActions';
import { mailtoHref, whatsappHref } from '@/lib/referentView';
import type { PreparedMessage } from './ShareLinks';

/**
 * One generic reminder for everybody (TASK-S, ADR 0039). The referent knows which link went to
 * whom, so we never say who has not answered; the same message goes to the whole team and says
 * "if you have not answered yet". Copy, email and WhatsApp only: nothing is sent from here.
 */
export default function ReminderCard({
  message,
  when,
  due,
}: {
  message: PreparedMessage;
  /** Lines saying when to send it (suggested days, next day), already in words. */
  when: readonly string[];
  due: boolean;
}) {
  const { t } = useI18n();
  const actions = useLinkActions();
  const [text, setText] = useState(message.text);

  // The Home call to action links here (`#reminder`): scroll to it once the page is painted.
  useEffect(() => {
    if (window.location.hash === '#reminder') {
      document.getElementById('reminder')?.scrollIntoView({ block: 'start' });
    }
  }, []);

  return (
    <Paper
      id="reminder"
      variant="outlined"
      sx={{ p: 4, borderRadius: 3, scrollMarginTop: 96 }}
      data-testid="client-reminder"
    >
      <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {t('client.invitations.remindTitle')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 0 }}>
        {t('client.invitations.remindHint')}
      </Typography>
      <Stack spacing={1} sx={{ mt: 3, mb: 4 }} data-testid="client-reminder-when">
        {when.map((line, i) => (
          <Typography key={i} variant="body1" sx={{ m: 0 }}>
            {i === 0 && due ? <StatusText status="info">{line}</StatusText> : line}
          </Typography>
        ))}
      </Stack>
      <TextField
        multiline
        fullWidth
        minRows={6}
        label={t('client.invitations.remindLabel')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'client-reminder-text' } }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          onClick={() => void actions.copy(text, t('client.invitations.copied'))}
          startIcon={<AppIcon name="copy" size={16} />}
          data-testid="client-reminder-copy"
          sx={{ minHeight: 44 }}
        >
          {t('client.invitations.remindCopy')}
        </Button>
        {actions.canShare ? (
          <Button
            variant="outlined"
            onClick={() => void actions.share(text)}
            startIcon={<AppIcon name="share" size={16} />}
            data-testid="client-reminder-share"
            sx={{ minHeight: 44 }}
          >
            {t('common.copy.share')}
          </Button>
        ) : null}
        <Button
          variant="outlined"
          href={mailtoHref(message.subject, text)}
          startIcon={<AppIcon name="email" size={16} />}
          data-testid="client-reminder-email"
          sx={{ minHeight: 44 }}
        >
          {t('client.invitations.email')}
        </Button>
        <Button
          variant="outlined"
          href={whatsappHref(text)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<AppIcon name="whatsapp" size={16} />}
          data-testid="client-reminder-whatsapp"
          sx={{ minHeight: 44 }}
        >
          {t('client.invitations.whatsapp')}
        </Button>
      </Stack>
      {actions.dialog}
    </Paper>
  );
}
