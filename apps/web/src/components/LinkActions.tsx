'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useNotify } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { canShare, copyText, shareText } from '@/lib/clipboard';

/**
 * Copy and share for links (TASK-Z1): `copy` uses the clipboard with a fallback; when both fail
 * `dialog` shows the full text in a selected, read-only field. `share` opens the native share
 * sheet when the device has one. Render `dialog` once next to the buttons.
 */
export function useLinkActions(): {
  copy: (text: string, done: string) => Promise<void>;
  share: (text: string) => Promise<void>;
  canShare: boolean;
  dialog: ReactNode;
} {
  const { t } = useI18n();
  const notify = useNotify();
  const [shown, setShown] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, done: string) => {
      if (await copyText(text)) notify(done);
      else setShown(text);
    },
    [notify],
  );
  // Cancelling the share sheet is not a failure: nothing to say.
  const share = useCallback(async (text: string) => {
    await shareText({ text });
  }, []);
  // Known only in the browser: read after mount so the server and first client render agree.
  const [sharable, setSharable] = useState(false);
  useEffect(() => setSharable(canShare()), []);

  const dialog = (
    <Dialog open={shown !== null} onClose={() => setShown(null)} fullWidth maxWidth="sm">
      <DialogTitle>{t('common.copy.fallbackTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>{t('common.copy.fallbackHelp')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          maxRows={10}
          value={shown ?? ''}
          label={t('common.copy.fullText')}
          slotProps={{ htmlInput: { readOnly: true, 'data-testid': 'copy-fallback-text' } }}
          onFocus={(e) => e.target.select()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShown(null)} sx={{ minHeight: 44 }}>
          {t('common.copy.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { copy, share, canShare: sharable, dialog };
}
